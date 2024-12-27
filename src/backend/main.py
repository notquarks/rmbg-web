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

# Create a global lock for GPU operations
gpu_lock = asyncio.Lock()

# Dictionary to store loaded models
loaded_models = {}


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


async def load_carvekit_model(model_name):
    model_key = f"carvekit-{model_name}"
    if model_key not in loaded_models:
        logger.info(f"Initializing CarveKit model: {model_name}")
        if model_name == 'u2net':
            loaded_models[model_key] = initialize_carvekit_model(U2NET)
        elif model_name == 'tracer':
            loaded_models[model_key] = initialize_carvekit_model(
                TracerUniversalB7)
        elif model_name == 'basnet':
            loaded_models[model_key] = initialize_carvekit_model(BASNET)
        elif model_name == 'deeplab':
            loaded_models[model_key] = initialize_carvekit_model(DeepLabV3)
    return loaded_models[model_key]


async def load_bria_model():
    if 'bria' not in loaded_models:
        logger.info("Initializing BRIA model")
        loaded_models['bria'] = pipeline("image-segmentation", model="briaai/RMBG-1.4",
                                         trust_remote_code=True, device="cpu")
    return loaded_models['bria']


async def load_inspyrenet_model():
    if 'inspyrenet' not in loaded_models:
        logger.info("Initializing InSPyReNet model")
        model = Remover()
        if not torch.cuda.is_available():
            model.model.cpu()
        loaded_models['inspyrenet'] = model
    return loaded_models['inspyrenet']


async def load_rembg_model(model_name):
    model_key = f"rembg-{model_name}"
    if model_key not in loaded_models:
        logger.info(f"Initializing rembg model: {model_name}")
        if model_name == 'u2net':
            loaded_models[model_key] = new_session('u2net')
        elif model_name == 'u2net_human_seg':
            loaded_models[model_key] = new_session('u2net_human_seg')
        elif model_name == 'isnet':
            loaded_models[model_key] = new_session('isnet-general-use')
        elif model_name == 'isnet_anime':
            loaded_models[model_key] = new_session('isnet-anime')
    return loaded_models[model_key]


async def process_with_carvekit(image, model_name):
    model = await load_carvekit_model(model_name.replace('carvekit-', ''))
    return model([image])[0]


async def process_with_bria(image):
    model = await load_bria_model()
    result = model(image, return_mask=True)
    mask = result
    if not isinstance(mask, Image.Image):
        mask = Image.fromarray((mask * 255).astype('uint8'))
    no_bg_image = Image.new("RGBA", image.size, (0, 0, 0, 0))
    no_bg_image.paste(image, mask=mask)
    return no_bg_image


async def process_with_inspyrenet(image):
    model = await load_inspyrenet_model()
    return model.process(image, type='rgba')


async def process_with_rembg(image, model_name):
    model_name = model_name.replace('rembg-', '')
    if model_name == 'isnet':
        model_name = 'isnet-general-use'
    model = await load_rembg_model(model_name)
    return rembg_remove(image, session=model)


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
                    output_image = await process_with_carvekit(input_image, algorithm)
                finally:
                    if 'carvekit-' in algorithm:
                        model_name = algorithm.replace('carvekit-', '')
                        if f'carvekit-{model_name}' in loaded_models:
                            loaded_models[f'carvekit-{model_name}'].segmentation_pipeline.to(
                                'cpu')
        elif algorithm == 'bria':
            output_image = await process_with_bria(input_image)
        elif algorithm == 'inspyrenet':
            async with gpu_lock:
                output_image = await process_with_inspyrenet(input_image)
        elif algorithm.startswith('rembg-'):
            output_image = await process_with_rembg(input_image, algorithm)
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
