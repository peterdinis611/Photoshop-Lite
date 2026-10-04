import {
  RemoveBgRequestDto,
  RemoveBgResponseDto,
  UpscaleRequestDto,
  UpscaleResponseDto,
  PredictionPollRequestDto,
  PredictionPollResponseDto,
} from '@photoshop-lite/shared-types';

export class AiEngineService {
  /**
   * Process background removal through remove.bg or cloud/fallback
   */
  async removeBackground(dto: RemoveBgRequestDto): Promise<RemoveBgResponseDto> {
    const { imageBase64, apiKey, provider } = dto;

    if (!imageBase64) {
      throw new Error('Missing imageBase64 parameter');
    }

    if (provider === 'remove.bg' || apiKey) {
      const key = apiKey || process.env.REMOVE_BG_API_KEY;
      if (!key) {
        throw new Error('No remove.bg API key provided');
      }

      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': key,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          image_file_b64: cleanBase64,
          size: 'auto',
          format: 'png',
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`remove.bg error: ${errText}`);
      }

      const data = (await response.json()) as { data?: { result_b64?: string } };
      if (data?.data?.result_b64) {
        return {
          success: true,
          imageBase64: `data:image/png;base64,${data.data.result_b64}`,
        };
      }
    }

    return {
      fallback: true,
      message: 'Server-side key not provided, use client-side neural wasm engine.',
    };
  }

  /**
   * Upscale image via Replicate Real-ESRGAN or return client fallback recommendation
   */
  async upscale(dto: UpscaleRequestDto): Promise<UpscaleResponseDto> {
    const { imageBase64, apiKey, scale = 2, faceEnhance = true } = dto;
    const token = apiKey || process.env.REPLICATE_API_TOKEN;

    if (!imageBase64) {
      throw new Error('Missing imageBase64 parameter');
    }

    if (token) {
      const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: '42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b',
          input: {
            image: imageBase64,
            scale: Number(scale),
            face_enhance: Boolean(faceEnhance),
          },
        }),
      });

      const prediction = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !prediction.id) {
        throw new Error(prediction.error || 'Failed to start upscale prediction on Replicate');
      }

      return {
        success: true,
        predictionId: prediction.id,
        statusUrl: `https://api.replicate.com/v1/predictions/${prediction.id}`,
      };
    }

    return {
      success: false,
      fallbackToClient: true,
      message: 'No Replicate API token provided. Client-side super-resolution applied.',
    };
  }

  /**
   * Poll a Replicate prediction and return the output image when ready.
   */
  async pollPrediction(dto: PredictionPollRequestDto): Promise<PredictionPollResponseDto> {
    const token = dto.apiKey || process.env.REPLICATE_API_TOKEN;
    if (!token) {
      throw new Error('No Replicate API token provided');
    }

    const statusUrl =
      dto.statusUrl ||
      (dto.predictionId
        ? `https://api.replicate.com/v1/predictions/${dto.predictionId}`
        : null);

    if (!statusUrl) {
      throw new Error('Missing predictionId or statusUrl');
    }

    const response = await fetch(statusUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Replicate poll error: ${errText}`);
    }

    const prediction = (await response.json()) as {
      status?: string;
      error?: string;
      output?: string | string[];
    };

    const status = prediction.status || 'processing';

    if (status === 'failed' || status === 'canceled') {
      return { status, error: prediction.error || `Prediction ${status}` };
    }

    if (status !== 'succeeded') {
      return { status };
    }

    const outputUrl = Array.isArray(prediction.output)
      ? prediction.output[0]
      : prediction.output;

    if (!outputUrl || typeof outputUrl !== 'string') {
      return { status: 'failed', error: 'Prediction succeeded but returned no image URL' };
    }

    const imageRes = await fetch(outputUrl);
    if (!imageRes.ok) {
      throw new Error('Failed to download upscaled image from Replicate');
    }

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const contentType = imageRes.headers.get('content-type') || 'image/png';
    const imageBase64 = `data:${contentType};base64,${buffer.toString('base64')}`;

    return { status: 'succeeded', imageBase64, outputUrl };
  }
}
