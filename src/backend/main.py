from carvekit.trimap.generator import TrimapGenerator
from carvekit.pipelines.preprocessing import PreprocessingStub
from carvekit.pipelines.postprocessing import MattingMethod
from carvekit.api.interface import Interface
from carvekit.ml.wrap.tracer_b7 import TracerUniversalB7
from carvekit.ml.wrap.deeplab_v3 import DeepLabV3
from carvekit.ml.wrap.fba_matting import FBAMatting
from carvekit.ml.wrap.basnet import BASNET
from carvekit.ml.wrap.u2net import U2NET
import io
import logging
import torch
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks
from fastapi.responses import Response, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import numpy as np
from transformers import pipeline
from transparent_background import Remover
from rembg import remove as rembg_remove, new_session
import time
import asyncio
from contextlib import contextmanager
from carvekit.ml.files.models_loc import download_all

# Download CarveKit models
download_all()


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize CarveKit models


def initialize_carvekit_model(seg_pipe_class, device='cuda' if torch.cuda.is_available() else 'cpu'):
    model = Interface(
        pre_pipe=PreprocessingStub(),
        post_pipe=MattingMethod(
            matting_module=FBAMatting(
                device=device, input_tensor_size=2048, batch_size=1),
            trimap_generator=TrimapGenerator(),
            device=device
        ),
        seg_pipe=seg_pipe_class(device=device, batch_size=1)
    )
    if device == 'cpu':
        model.segmentation_pipeline.to('cpu')
    return model


# Pre-load all models
logger.info("Initializing all models...")

# Initialize CarveKit models
carvekit_models = {
    'u2net': initialize_carvekit_model(U2NET),
    'tracer': initialize_carvekit_model(TracerUniversalB7),
    'basnet': initialize_carvekit_model(BASNET),
    'deeplab': initialize_carvekit_model(DeepLabV3)
}

# Initialize BRIA model
logger.info("Initializing BRIA model...")
bria_model = pipeline("image-segmentation", model="briaai/RMBG-1.4",
                      trust_remote_code=True, device="cpu")

# Initialize InSPyReNet model
logger.info("Initializing InSPyReNet model...")
inspyrenet_model = Remover()
inspyrenet_model.model.cpu()

# Initialize rembg models
logger.info("Initializing rembg models...")
rembg_models = {
    'u2net': new_session('u2net'),
    'u2net_human_seg': new_session('u2net_human_seg'),
    'isnet-general-use': new_session('isnet-general-use'),
    'isnet-anime': new_session('isnet-anime')
}

# Create a global lock for GPU operations
gpu_lock = asyncio.Lock()


def process_with_carvekit(image, model_name):
    model = carvekit_models[model_name.replace('carvekit-', '')]
    return model([image])[0]


def process_with_bria(image):
    result = bria_model(image, return_mask=True)
    mask = result
    if not isinstance(mask, Image.Image):
        mask = Image.fromarray((mask * 255).astype('uint8'))
    no_bg_image = Image.new("RGBA", image.size, (0, 0, 0, 0))
    no_bg_image.paste(image, mask=mask)
    return no_bg_image


def process_with_inspyrenet(image):
    return inspyrenet_model.process(image, type='rgba')


def process_with_rembg(image, model_name):
    model = model_name.replace('rembg-', '')
    if model == 'isnet':
        model = 'isnet-general-use'
    return rembg_remove(image, session=rembg_models[model])


@app.post("/api/remove-bg")
async def remove_background(
    image: UploadFile = File(...),
    algorithm: str = Form("carvekit-tracer"),
    is_transparent: bool = Form(True),
    background_color: str = Form("#ffffff")
):
    try:
        logger.info(f"Processing image: {image.filename}")
        logger.info(
            f"Parameters: algorithm={algorithm}, is_transparent={is_transparent}, background_color={background_color}")

        # Read and prepare the image
        contents = await image.read()
        input_image = Image.open(io.BytesIO(contents)).convert('RGB')

        start_time = time.time()

        # Process the image based on the algorithm
        if algorithm.startswith('carvekit-'):
            async with gpu_lock:
                try:
                    model = carvekit_models[algorithm.replace('carvekit-', '')]
                    model.segmentation_pipeline.to('cuda')
                    output_image = await asyncio.to_thread(model, [input_image])
                    output_image = output_image[0]
                finally:
                    model.segmentation_pipeline.to('cpu')
        elif algorithm == 'bria':
            output_image = await asyncio.to_thread(process_with_bria, input_image)
        elif algorithm == 'inspyrenet':
            async with gpu_lock:
                try:
                    inspyrenet_model.model.to('cuda')
                    output_image = await asyncio.to_thread(inspyrenet_model.process, input_image, type='rgba')
                finally:
                    inspyrenet_model.model.to('cpu')
        elif algorithm.startswith('rembg-'):
            output_image = await asyncio.to_thread(process_with_rembg, input_image, algorithm)
        else:
            raise HTTPException(status_code=400, detail="Invalid algorithm")

        process_time = time.time() - start_time
        logger.info(
            f"Processing time ({algorithm}): {process_time:.2f} seconds")

        # Handle transparency and background color
        if not is_transparent:
            if output_image.mode != 'RGBA':
                output_image = output_image.convert('RGBA')
            background = Image.new(
                'RGBA', output_image.size, hex_to_rgb(background_color) + (255,))
            output_image = Image.alpha_composite(background, output_image)
            output_image = output_image.convert('RGB')

        # Convert to bytes
        img_byte_arr = io.BytesIO()
        if is_transparent:
            output_image.save(img_byte_arr, format='PNG', optimize=True)
            media_type = "image/png"
        else:
            output_image.save(img_byte_arr, format='JPEG',
                              quality=95, optimize=True)
            media_type = "image/jpeg"

        img_byte_arr = img_byte_arr.getvalue()
        return Response(content=img_byte_arr, media_type=media_type)

    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "device": 'cuda' if torch.cuda.is_available() else 'cpu',
        "available_algorithms": [
            "carvekit-tracer",
            "carvekit-u2net",
            "carvekit-basnet",
            "carvekit-deeplab",
            "bria",
            "inspyrenet",
            "rembg-u2net",
            "rembg-u2net-human",
            "rembg-isnet",
            "rembg-isnet-anime"
        ]
    }
