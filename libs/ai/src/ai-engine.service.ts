import {
  RemoveBgRequestDto,
  RemoveBgResponseDto,
  UpscaleRequestDto,
  UpscaleResponseDto,
  PredictionPollRequestDto,
  PredictionPollResponseDto,
  AiJobRequestDto,
  AiJobResponseDto,
  AiStylePreset,
  AiRelightPreset,
} from '@photoshop-lite/shared-types';
import { REAL_ESRGAN_VERSION, REPLICATE_MODEL_REFS, styleModelRef } from './replicate-models';

type PredictionStart = {
  id?: string;
  error?: string;
  status?: string;
  urls?: { get?: string };
};

export class AiEngineService {
  private replicateToken(override?: string): string | undefined {
    return override || process.env.REPLICATE_API_TOKEN || undefined;
  }

  private stripDataUrl(imageBase64: string): string {
    return imageBase64.replace(/^data:image\/\w+;base64,/, '');
  }

  private ensureDataUrl(imageBase64: string): string {
    if (imageBase64.startsWith('data:')) return imageBase64;
    return `data:image/png;base64,${imageBase64}`;
  }

  /**
   * Start a Replicate prediction via model owner/name (preferred) or pinned version.
   */
  async startPrediction(options: {
    model?: string;
    version?: string;
    input: Record<string, unknown>;
    apiKey?: string;
  }): Promise<AiJobResponseDto> {
    const token = this.replicateToken(options.apiKey);
    if (!token) {
      return {
        success: false,
        fallbackToClient: true,
        message: 'No Replicate API token configured (set REPLICATE_API_TOKEN).',
      };
    }

    const url = options.model
      ? `https://api.replicate.com/v1/models/${options.model}/predictions`
      : 'https://api.replicate.com/v1/predictions';

    const body = options.model
      ? { input: options.input }
      : { version: options.version, input: options.input };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'wait=0',
      },
      body: JSON.stringify(body),
    });

    const prediction = (await response.json()) as PredictionStart;
    if (!response.ok || !prediction.id) {
      throw new Error(prediction.error || `Failed to start Replicate job (${response.status})`);
    }

    return {
      success: true,
      predictionId: prediction.id,
      statusUrl:
        prediction.urls?.get || `https://api.replicate.com/v1/predictions/${prediction.id}`,
    };
  }

  async removeBackground(dto: RemoveBgRequestDto): Promise<RemoveBgResponseDto> {
    const { imageBase64, apiKey, provider } = dto;

    if (!imageBase64) {
      throw new Error('Missing imageBase64 parameter');
    }

    if (provider === 'remove.bg' || apiKey || process.env.REMOVE_BG_API_KEY) {
      const key = apiKey || process.env.REMOVE_BG_API_KEY;
      if (!key) {
        throw new Error('No remove.bg API key provided');
      }

      const cleanBase64 = this.stripDataUrl(imageBase64);
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

  async upscale(dto: UpscaleRequestDto): Promise<UpscaleResponseDto> {
    const { imageBase64, apiKey, scale = 2, faceEnhance = true } = dto;

    if (!imageBase64) {
      throw new Error('Missing imageBase64 parameter');
    }

    const started = await this.startPrediction({
      version: REAL_ESRGAN_VERSION,
      apiKey,
      input: {
        image: this.ensureDataUrl(imageBase64),
        scale: Number(scale),
        face_enhance: Boolean(faceEnhance),
      },
    });

    if (started.fallbackToClient) {
      return {
        success: false,
        fallbackToClient: true,
        message: started.message,
      };
    }

    return {
      success: true,
      predictionId: started.predictionId,
      statusUrl: started.statusUrl,
    };
  }

  async cleanup(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    if (!dto.imageBase64) throw new Error('Missing imageBase64');
    return this.startPrediction({
      model: REPLICATE_MODEL_REFS.cleanup,
      apiKey: dto.apiKey,
      input: {
        image: this.ensureDataUrl(dto.imageBase64),
        task_type: 'Real-World Image Super-Resolution-Large',
        noise: Math.round((dto.intensity ?? 0.5) * 15),
        jpeg: 40,
      },
    });
  }

  async revive(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    if (!dto.imageBase64) throw new Error('Missing imageBase64');
    return this.startPrediction({
      model: REPLICATE_MODEL_REFS.revive,
      apiKey: dto.apiKey,
      input: {
        image: this.ensureDataUrl(dto.imageBase64),
        model_size: 'large',
      },
    });
  }

  async faceRestore(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    if (!dto.imageBase64) throw new Error('Missing imageBase64');
    const w = dto.intensity ?? 0.7;
    return this.startPrediction({
      model: REPLICATE_MODEL_REFS.faceRestore,
      apiKey: dto.apiKey,
      input: {
        image: this.ensureDataUrl(dto.imageBase64),
        codeformer_fidelity: Math.max(0, Math.min(1, 1 - w * 0.5)),
        upscale: 1,
      },
    });
  }

  async inpaint(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    if (!dto.imageBase64) throw new Error('Missing imageBase64');
    if (!dto.maskBase64) throw new Error('Missing maskBase64 for inpaint');
    return this.startPrediction({
      model: REPLICATE_MODEL_REFS.inpaint,
      apiKey: dto.apiKey,
      input: {
        image: this.ensureDataUrl(dto.imageBase64),
        mask: this.ensureDataUrl(dto.maskBase64),
        prompt: dto.prompt || 'seamless photorealistic fill, match lighting and texture',
        negative_prompt: 'blurry, distorted, watermark, text',
        num_inference_steps: 30,
      },
    });
  }

  /** Object remove — same inpaint model, fixed “erase & fill” prompt (no user text). */
  async objectRemove(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    if (!dto.imageBase64) throw new Error('Missing imageBase64');
    if (!dto.maskBase64) throw new Error('Missing maskBase64 for object-remove');
    return this.startPrediction({
      model: REPLICATE_MODEL_REFS.objectRemove,
      apiKey: dto.apiKey,
      input: {
        image: this.ensureDataUrl(dto.imageBase64),
        mask: this.ensureDataUrl(dto.maskBase64),
        prompt:
          'remove the masked object completely, seamless photorealistic background fill, match surrounding lighting texture and perspective, no people no text no watermark',
        negative_prompt: 'object remaining, ghosting, blurry, distorted, watermark, text, artifact',
        num_inference_steps: 32,
      },
    });
  }

  /** Outpaint — generate white-masked border; keep black region. */
  async outpaint(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    if (!dto.imageBase64) throw new Error('Missing imageBase64');
    if (!dto.maskBase64) throw new Error('Missing maskBase64 for outpaint');
    return this.startPrediction({
      model: REPLICATE_MODEL_REFS.outpaint,
      apiKey: dto.apiKey,
      input: {
        image: this.ensureDataUrl(dto.imageBase64),
        mask: this.ensureDataUrl(dto.maskBase64),
        prompt:
          dto.prompt ||
          'extend the scene seamlessly beyond the frame, photorealistic continuation, match lighting perspective and texture, natural environment',
        negative_prompt: 'border, frame, watermark, text, distorted, blurry, hard edge seam',
        num_inference_steps: 32,
      },
    });
  }

  async relight(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    if (!dto.imageBase64) throw new Error('Missing imageBase64');
    const mode: AiRelightPreset = dto.relight || 'softbox';
    const promptMap: Record<AiRelightPreset, string> = {
      softbox:
        'professional studio softbox lighting, even soft key light, photorealistic, preserve identity and composition',
      rim: 'dramatic rim lighting, cinematic edge light separating subject, photorealistic, preserve identity',
      golden:
        'golden hour warm sunlight, soft amber highlights, gentle contrast, photorealistic, preserve identity',
    };

    return this.startPrediction({
      model: REPLICATE_MODEL_REFS.relight,
      apiKey: dto.apiKey,
      input: {
        image: this.ensureDataUrl(dto.imageBase64),
        prompt: dto.prompt || promptMap[mode],
        strength: Math.min(0.75, Math.max(0.35, dto.intensity ?? 0.55)),
      },
    });
  }

  async styleTransfer(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    if (!dto.imageBase64) throw new Error('Missing imageBase64');
    const style = (dto.style || 'film') as AiStylePreset;
    const model = styleModelRef(style);
    const promptMap: Record<AiStylePreset, string> = {
      film: 'cinematic film still, kodak portra, soft grain',
      sketch: 'detailed pencil sketch, clean line art',
      anime: 'anime illustration, vibrant cel shading',
      watercolor: 'watercolor painting, soft washes',
      noir: 'high contrast black and white noir photography',
    };

    return this.startPrediction({
      model,
      apiKey: dto.apiKey,
      input: {
        image: this.ensureDataUrl(dto.imageBase64),
        prompt: dto.prompt || promptMap[style],
        strength: dto.intensity ?? 0.65,
      },
    });
  }

  async segment(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    if (!dto.imageBase64) throw new Error('Missing imageBase64');
    return this.startPrediction({
      model: REPLICATE_MODEL_REFS.segment,
      apiKey: dto.apiKey,
      input: {
        image: this.ensureDataUrl(dto.imageBase64),
        caption: dto.prompt || 'person',
      },
    });
  }

  async caption(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    if (!dto.imageBase64) throw new Error('Missing imageBase64');
    return this.startPrediction({
      model: REPLICATE_MODEL_REFS.caption,
      apiKey: dto.apiKey,
      input: {
        image: this.ensureDataUrl(dto.imageBase64),
        task: 'image_captioning',
      },
    });
  }

  async pollPrediction(dto: PredictionPollRequestDto): Promise<PredictionPollResponseDto> {
    const token = this.replicateToken(dto.apiKey);
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
      output?: string | string[] | Record<string, unknown>;
    };

    const status = prediction.status || 'processing';

    if (status === 'failed' || status === 'canceled') {
      return { status, error: prediction.error || `Prediction ${status}` };
    }

    if (status !== 'succeeded') {
      return { status };
    }

    const output = prediction.output;

    // Text caption jobs
    if (typeof output === 'string' && !output.startsWith('http') && !output.startsWith('data:')) {
      return { status: 'succeeded', text: output };
    }

    if (output && typeof output === 'object' && !Array.isArray(output)) {
      const caption =
        (output as { caption?: string; text?: string }).caption ||
        (output as { caption?: string; text?: string }).text;
      if (caption) {
        return { status: 'succeeded', text: caption };
      }
    }

    const outputUrl = Array.isArray(output)
      ? output.find((u) => typeof u === 'string' && (u.startsWith('http') || u.startsWith('data:')))
      : typeof output === 'string'
        ? output
        : undefined;

    if (!outputUrl || typeof outputUrl !== 'string') {
      // Sometimes segment returns nested mask URL
      if (Array.isArray(output) && output.length > 0) {
        const first = output[0];
        if (typeof first === 'string') {
          return this.downloadAsBase64(first, status);
        }
      }
      return { status: 'failed', error: 'Prediction succeeded but returned no usable output' };
    }

    if (outputUrl.startsWith('data:')) {
      return { status: 'succeeded', imageBase64: outputUrl, outputUrl };
    }

    return this.downloadAsBase64(outputUrl, status);
  }

  private async downloadAsBase64(
    outputUrl: string,
    status: string
  ): Promise<PredictionPollResponseDto> {
    const imageRes = await fetch(outputUrl);
    if (!imageRes.ok) {
      throw new Error('Failed to download result from Replicate');
    }

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const contentType = imageRes.headers.get('content-type') || 'image/png';

    // BLIP sometimes returns JSON/text
    if (contentType.includes('text') || contentType.includes('json')) {
      return { status: 'succeeded', text: buffer.toString('utf8'), outputUrl };
    }

    const imageBase64 = `data:${contentType};base64,${buffer.toString('base64')}`;
    return { status: 'succeeded', imageBase64, outputUrl };
  }
}
