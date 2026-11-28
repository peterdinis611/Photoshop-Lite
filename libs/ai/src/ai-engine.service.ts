import type {
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
import { hfCaption, hfSegmentHint, hfUpscale, huggingfaceToken } from './huggingface';
import {
  clipdropCleanup,
  clipdropKey,
  clipdropReimagine,
  clipdropUncrop,
  deepAiColorize,
  deepAiKey,
  deepAiStyle,
  deepAiSuperRes,
  falInpaint,
  falKey,
  falRemoveBg,
  falUpscale,
  fireworksKey,
  photoroomKey,
  photoroomRemoveBg,
  textToImageFill,
  togetherKey,
} from './providers';

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

    const tryRemoveBg = provider === 'remove.bg' || (!provider && (apiKey || process.env.REMOVE_BG_API_KEY));
    if (tryRemoveBg) {
      const key = apiKey || process.env.REMOVE_BG_API_KEY;
      if (key) {
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

        if (response.ok) {
          const data = (await response.json()) as { data?: { result_b64?: string } };
          if (data?.data?.result_b64) {
            return {
              success: true,
              imageBase64: `data:image/png;base64,${data.data.result_b64}`,
            };
          }
        }
      }
    }

    if (provider === 'photoroom' || (!provider && photoroomKey())) {
      try {
        const result = await photoroomRemoveBg({ imageBase64, apiKey });
        return { success: true, imageBase64: result.imageBase64 };
      } catch {
        /* try fal */
      }
    }

    if (provider === 'fal' || (!provider && falKey())) {
      try {
        const result = await falRemoveBg({ imageBase64 });
        return { success: true, imageBase64: result.imageBase64 };
      } catch {
        /* fall through */
      }
    }

    return {
      fallback: true,
      message:
        'No cutout provider key (remove.bg / PhotoRoom / fal) — use client-side neural wasm engine.',
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

    if (!started.fallbackToClient) {
      return {
        success: true,
        predictionId: started.predictionId,
        statusUrl: started.statusUrl,
      };
    }

    if (falKey()) {
      try {
        const result = await falUpscale({ imageBase64, scale: Number(scale) });
        return { success: true, imageBase64: result.imageBase64 };
      } catch {
        /* try next */
      }
    }

    if (deepAiKey()) {
      try {
        const result = await deepAiSuperRes({ imageBase64 });
        return { success: true, imageBase64: result.imageBase64 };
      } catch {
        /* try next */
      }
    }

    const hf = huggingfaceToken();
    if (hf) {
      try {
        const image = await hfUpscale(imageBase64, hf);
        return { success: true, imageBase64: image };
      } catch {
        /* fall through to client */
      }
    }

    return {
      success: false,
      fallbackToClient: true,
      message: started.message || 'No Replicate/fal/DeepAI/HF token — use client upscale.',
    };
  }

  async cleanup(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    if (!dto.imageBase64) throw new Error('Missing imageBase64');
    const started = await this.startPrediction({
      model: REPLICATE_MODEL_REFS.cleanup,
      apiKey: dto.apiKey,
      input: {
        image: this.ensureDataUrl(dto.imageBase64),
        task_type: 'Real-World Image Super-Resolution-Large',
        noise: Math.round((dto.intensity ?? 0.5) * 15),
        jpeg: 40,
      },
    });
    if (!started.fallbackToClient) return started;

    if (clipdropKey()) {
      try {
        const result = await clipdropCleanup({
          imageBase64: dto.imageBase64,
          maskBase64: dto.maskBase64,
        });
        return { success: true, imageBase64: result.imageBase64 };
      } catch {
        /* fall through */
      }
    }
    return started;
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
    const started = await this.startPrediction({
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
    if (!started.fallbackToClient) return started;

    if (falKey()) {
      try {
        const result = await falInpaint({
          imageBase64: dto.imageBase64,
          maskBase64: dto.maskBase64,
          prompt: dto.prompt,
        });
        return { success: true, imageBase64: result.imageBase64 };
      } catch {
        /* try text→image fill when prompt present */
      }
    }

    if (dto.prompt?.trim() && (togetherKey() || fireworksKey())) {
      try {
        const result = await textToImageFill({ prompt: dto.prompt.trim() });
        return {
          success: true,
          imageBase64: result.imageBase64,
          message: 'Generated via Together/Fireworks text→image (not mask-aware)',
        };
      } catch {
        /* fall through */
      }
    }
    return started;
  }

  /** Object remove — same inpaint model, fixed “erase & fill” prompt (no user text). */
  async objectRemove(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    if (!dto.imageBase64) throw new Error('Missing imageBase64');
    if (!dto.maskBase64) throw new Error('Missing maskBase64 for object-remove');
    const started = await this.startPrediction({
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
    if (!started.fallbackToClient) return started;

    if (falKey()) {
      try {
        const result = await falInpaint({
          imageBase64: dto.imageBase64,
          maskBase64: dto.maskBase64,
          prompt:
            'remove the masked object completely, seamless photorealistic background fill',
        });
        return { success: true, imageBase64: result.imageBase64 };
      } catch {
        /* try clipdrop cleanup with mask */
      }
    }

    if (clipdropKey()) {
      try {
        const result = await clipdropCleanup({
          imageBase64: dto.imageBase64,
          maskBase64: dto.maskBase64,
        });
        return { success: true, imageBase64: result.imageBase64 };
      } catch {
        /* fall through */
      }
    }
    return started;
  }

  /** Outpaint — generate white-masked border; keep black region. */
  async outpaint(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    if (!dto.imageBase64) throw new Error('Missing imageBase64');
    if (!dto.maskBase64) throw new Error('Missing maskBase64 for outpaint');
    const started = await this.startPrediction({
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
    if (!started.fallbackToClient) return started;

    if (clipdropKey()) {
      try {
        const result = await clipdropUncrop({ imageBase64: dto.imageBase64 });
        return { success: true, imageBase64: result.imageBase64 };
      } catch {
        /* fall through */
      }
    }

    if (falKey()) {
      try {
        const result = await falInpaint({
          imageBase64: dto.imageBase64,
          maskBase64: dto.maskBase64,
          prompt: dto.prompt || 'extend the scene seamlessly beyond the frame',
        });
        return { success: true, imageBase64: result.imageBase64 };
      } catch {
        /* fall through */
      }
    }
    return started;
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

    const started = await this.startPrediction({
      model,
      apiKey: dto.apiKey,
      input: {
        image: this.ensureDataUrl(dto.imageBase64),
        prompt: dto.prompt || promptMap[style],
        strength: dto.intensity ?? 0.65,
      },
    });
    if (!started.fallbackToClient) return started;

    if (clipdropKey()) {
      try {
        const result = await clipdropReimagine({ imageBase64: dto.imageBase64 });
        return { success: true, imageBase64: result.imageBase64 };
      } catch {
        /* try DeepAI */
      }
    }

    if (deepAiKey()) {
      try {
        const result = await deepAiStyle({ imageBase64: dto.imageBase64 });
        return { success: true, imageBase64: result.imageBase64 };
      } catch {
        /* fall through */
      }
    }
    return started;
  }

  async colorize(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    if (!dto.imageBase64) throw new Error('Missing imageBase64');
    if (deepAiKey()) {
      try {
        const result = await deepAiColorize({ imageBase64: dto.imageBase64 });
        return { success: true, imageBase64: result.imageBase64 };
      } catch (err) {
        return {
          success: false,
          fallbackToClient: true,
          message: err instanceof Error ? err.message : 'DeepAI colorize failed',
        };
      }
    }
    // Replicate DDColor is revive — reuse when available
    return this.revive(dto);
  }

  async uncrop(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    if (!dto.imageBase64) throw new Error('Missing imageBase64');
    if (clipdropKey()) {
      try {
        const result = await clipdropUncrop({ imageBase64: dto.imageBase64 });
        return { success: true, imageBase64: result.imageBase64 };
      } catch (err) {
        return {
          success: false,
          fallbackToClient: true,
          message: err instanceof Error ? err.message : 'Clipdrop uncrop failed',
        };
      }
    }
    if (!dto.maskBase64) {
      return {
        success: false,
        fallbackToClient: true,
        message: 'Uncrop needs CLIPDROP_API_KEY (or outpaint with a border mask).',
      };
    }
    return this.outpaint(dto);
  }

  async reimagine(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    if (!dto.imageBase64) throw new Error('Missing imageBase64');
    if (clipdropKey()) {
      try {
        const result = await clipdropReimagine({ imageBase64: dto.imageBase64 });
        return { success: true, imageBase64: result.imageBase64 };
      } catch {
        /* try style transfer */
      }
    }
    return this.styleTransfer({ ...dto, style: dto.style || 'film' });
  }

  async segment(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    if (!dto.imageBase64) throw new Error('Missing imageBase64');
    const started = await this.startPrediction({
      model: REPLICATE_MODEL_REFS.segment,
      apiKey: dto.apiKey,
      input: {
        image: this.ensureDataUrl(dto.imageBase64),
        caption: dto.prompt || 'person',
      },
    });
    if (!started.fallbackToClient) return started;

    const hf = huggingfaceToken();
    if (hf) {
      try {
        const text = await hfSegmentHint(dto.imageBase64, hf, dto.prompt);
        return { success: true, text, message: 'Hugging Face subject hint (no mask)' };
      } catch (err) {
        return {
          success: false,
          fallbackToClient: true,
          message: err instanceof Error ? err.message : started.message,
        };
      }
    }
    return started;
  }

  async caption(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    if (!dto.imageBase64) throw new Error('Missing imageBase64');
    const started = await this.startPrediction({
      model: REPLICATE_MODEL_REFS.caption,
      apiKey: dto.apiKey,
      input: {
        image: this.ensureDataUrl(dto.imageBase64),
        task: 'image_captioning',
      },
    });
    if (!started.fallbackToClient) return started;

    const hf = huggingfaceToken();
    if (hf) {
      try {
        const text = await hfCaption(dto.imageBase64, hf);
        return { success: true, text };
      } catch (err) {
        return {
          success: false,
          fallbackToClient: true,
          message: err instanceof Error ? err.message : started.message,
        };
      }
    }
    return started;
  }

  async pollPrediction(dto: PredictionPollRequestDto): Promise<PredictionPollResponseDto> {
    const token = this.replicateToken(dto.apiKey);
    if (!token) {
      throw new Error('No Replicate API token provided');
    }

    const statusUrl = this.resolveReplicatePollUrl(dto);
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
          return this.downloadAsBase64(first);
        }
      }
      return { status: 'failed', error: 'Prediction succeeded but returned no usable output' };
    }

    if (outputUrl.startsWith('data:')) {
      return { status: 'succeeded', imageBase64: outputUrl, outputUrl };
    }

    return this.downloadAsBase64(outputUrl);
  }

  /** Only poll Replicate prediction URLs — never forward Bearer to arbitrary hosts. */
  private resolveReplicatePollUrl(dto: PredictionPollRequestDto): string {
    const PREDICTION_ID_RE = /^[a-zA-Z0-9_-]{8,128}$/;
    if (dto.predictionId) {
      if (!PREDICTION_ID_RE.test(dto.predictionId)) {
        throw new Error('Invalid predictionId');
      }
      return `https://api.replicate.com/v1/predictions/${dto.predictionId}`;
    }
    if (dto.statusUrl) {
      let parsed: URL;
      try {
        parsed = new URL(dto.statusUrl);
      } catch {
        throw new Error('Invalid statusUrl');
      }
      if (
        parsed.protocol !== 'https:' ||
        parsed.hostname !== 'api.replicate.com' ||
        !parsed.pathname.startsWith('/v1/predictions/')
      ) {
        throw new Error('statusUrl must be an https://api.replicate.com/v1/predictions/… URL');
      }
      return parsed.toString();
    }
    throw new Error('Missing predictionId or statusUrl');
  }

  private assertAllowedDownloadUrl(outputUrl: string): void {
    let parsed: URL;
    try {
      parsed = new URL(outputUrl);
    } catch {
      throw new Error('Invalid output URL');
    }
    if (parsed.protocol !== 'https:') {
      throw new Error('Only https result downloads are allowed');
    }
    const host = parsed.hostname.toLowerCase();
    const allowed =
      host === 'api.replicate.com' ||
      host === 'replicate.delivery' ||
      host.endsWith('.replicate.delivery') ||
      host === 'replicate.com' ||
      host.endsWith('.replicate.com') ||
      host.endsWith('.hf.co') ||
      host.endsWith('.huggingface.co') ||
      host.endsWith('.fal.media') ||
      host.endsWith('.fal.ai') ||
      host === 'fal.media' ||
      host.endsWith('.together.ai') ||
      host.endsWith('.fireworks.ai') ||
      host.endsWith('.deepai.org') ||
      host === 'api.deepai.org' ||
      host.endsWith('.clipdrop.co') ||
      host.endsWith('.photoroom.com');
    if (!allowed) {
      throw new Error(`Refusing to download from host: ${host}`);
    }
  }

  private async downloadAsBase64(outputUrl: string): Promise<PredictionPollResponseDto> {
    this.assertAllowedDownloadUrl(outputUrl);
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
