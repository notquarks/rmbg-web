// Worker for background removal using CarveKit API
const BACKEND_URL = "http://localhost:8000"; // Backend server URL

self.onmessage = async (e) => {
  const { type, data } = e.data;

  if (type === "reset") {
    // Reset state if needed
    self.postMessage({
      type: "ready",
    });
    // Inform main thread to reset algorithm
    self.postMessage({
      type: "reset_algorithm",
    });
  } else if (type === "segment") {
    try {
      // Indicate processing start
      self.postMessage({
        type: "segment_result",
        data: "start",
      });

      // Extract parameters from data
      const {
        imageUrl,
        algorithm = "inspyrenet",
        isTransparent = true,
        backgroundColor = "#ffffff",
      } = typeof data === "string" ? { imageUrl: data } : data;

      // Send image to Python backend for processing
      const formData = new FormData();
      const imageBlob = await fetch(imageUrl).then((r) => r.blob());
      formData.append("image", imageBlob);
      formData.append("algorithm", algorithm);
      formData.append("is_transparent", String(isTransparent));
      formData.append("background_color", backgroundColor);

      console.log("Sending request to backend...", {
        algorithm,
        isTransparent,
        backgroundColor,
      });

      const response = await fetch(`${BACKEND_URL}/api/remove-bg`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `Failed to process image: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage += ` - ${JSON.stringify(errorData)}`;
        } catch (e) {
          // If response is not JSON, use text
          const errorText = await response.text();
          errorMessage += ` - ${errorText}`;
        }
        throw new Error(errorMessage);
      }

      console.log("Received response from backend");
      const contentType = response.headers.get("content-type");
      console.log("Response content type:", contentType);

      const processedImageBlob = await response.blob();
      console.log("Processed image blob type:", processedImageBlob.type);

      const processedImageUrl = URL.createObjectURL(processedImageBlob);

      // Send back the processed image
      self.postMessage({
        type: "segment_result",
        data: "done",
      });

      self.postMessage({
        type: "decode_result",
        data: {
          mask: processedImageUrl,
          isTransparent: contentType.includes("png"),
        },
      });
    } catch (error) {
      console.error("Error processing image:", error);
      self.postMessage({
        type: "error",
        data: error.message || "Failed to process image",
      });
    }
  }
};
