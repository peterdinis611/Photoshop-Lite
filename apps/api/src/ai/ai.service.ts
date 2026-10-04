import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiEngineService } from '@photoshop-lite/ai';
import {
  RemoveBgRequestDto,
  RemoveBgResponseDto,
  UpscaleRequestDto,
  UpscaleResponseDto,
  PredictionPollRequestDto,
  PredictionPollResponseDto,
  AiJobRequestDto,
  AiJobResponseDto,
} from '@photoshop-lite/shared-types';

@Injectable()
export class AiService {
  private readonly aiEngine = new AiEngineService();

  private wrapUpstream<T>(fn: () => Promise<T>): Promise<T> {
    return fn().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      if (/api key|token|missing/i.test(message)) {
        throw new BadRequestException({ error: message, code: 'VALIDATION' });
      }
      throw new ServiceUnavailableException({ error: message, code: 'UPSTREAM' });
    });
  }

  private requireImage(dto: { imageBase64?: string }) {
    if (!dto?.imageBase64) {
      throw new BadRequestException({
        error: 'Missing imageBase64',
        code: 'VALIDATION',
      });
    }
  }

  async removeBackground(dto: RemoveBgRequestDto): Promise<RemoveBgResponseDto> {
    this.requireImage(dto);
    return this.wrapUpstream(() => this.aiEngine.removeBackground(dto));
  }

  async upscale(dto: UpscaleRequestDto): Promise<UpscaleResponseDto> {
    this.requireImage(dto);
    return this.wrapUpstream(() => this.aiEngine.upscale(dto));
  }

  async pollPrediction(dto: PredictionPollRequestDto): Promise<PredictionPollResponseDto> {
    if (!dto?.predictionId && !dto?.statusUrl) {
      throw new BadRequestException({
        error: 'Missing predictionId or statusUrl',
        code: 'VALIDATION',
      });
    }
    return this.wrapUpstream(() => this.aiEngine.pollPrediction(dto));
  }

  async cleanup(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    this.requireImage(dto);
    return this.wrapUpstream(() => this.aiEngine.cleanup(dto));
  }

  async revive(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    this.requireImage(dto);
    return this.wrapUpstream(() => this.aiEngine.revive(dto));
  }

  async faceRestore(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    this.requireImage(dto);
    return this.wrapUpstream(() => this.aiEngine.faceRestore(dto));
  }

  async inpaint(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    this.requireImage(dto);
    if (!dto.maskBase64) {
      throw new BadRequestException({
        error: 'Missing maskBase64 for inpaint',
        code: 'VALIDATION',
      });
    }
    return this.wrapUpstream(() => this.aiEngine.inpaint(dto));
  }

  async objectRemove(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    this.requireImage(dto);
    if (!dto.maskBase64) {
      throw new BadRequestException({
        error: 'Missing maskBase64 for object-remove',
        code: 'VALIDATION',
      });
    }
    return this.wrapUpstream(() => this.aiEngine.objectRemove(dto));
  }

  async outpaint(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    this.requireImage(dto);
    if (!dto.maskBase64) {
      throw new BadRequestException({
        error: 'Missing maskBase64 for outpaint',
        code: 'VALIDATION',
      });
    }
    return this.wrapUpstream(() => this.aiEngine.outpaint(dto));
  }

  async style(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    this.requireImage(dto);
    return this.wrapUpstream(() => this.aiEngine.styleTransfer(dto));
  }

  async relight(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    this.requireImage(dto);
    return this.wrapUpstream(() => this.aiEngine.relight(dto));
  }

  async segment(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    this.requireImage(dto);
    return this.wrapUpstream(() => this.aiEngine.segment(dto));
  }

  async caption(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    this.requireImage(dto);
    return this.wrapUpstream(() => this.aiEngine.caption(dto));
  }
}
