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
} from '@photoshop-lite/shared-types';

@Injectable()
export class AiService {
  private readonly aiEngine = new AiEngineService();

  async removeBackground(dto: RemoveBgRequestDto): Promise<RemoveBgResponseDto> {
    if (!dto?.imageBase64) {
      throw new BadRequestException({
        error: 'Missing imageBase64',
        code: 'VALIDATION',
      });
    }
    try {
      return await this.aiEngine.removeBackground(dto);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (/api key|token/i.test(message)) {
        throw new BadRequestException({ error: message, code: 'VALIDATION' });
      }
      throw new ServiceUnavailableException({ error: message, code: 'UPSTREAM' });
    }
  }

  async upscale(dto: UpscaleRequestDto): Promise<UpscaleResponseDto> {
    if (!dto?.imageBase64) {
      throw new BadRequestException({
        error: 'Missing imageBase64',
        code: 'VALIDATION',
      });
    }
    try {
      return await this.aiEngine.upscale(dto);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ServiceUnavailableException({ error: message, code: 'UPSTREAM' });
    }
  }

  async pollPrediction(dto: PredictionPollRequestDto): Promise<PredictionPollResponseDto> {
    if (!dto?.predictionId && !dto?.statusUrl) {
      throw new BadRequestException({
        error: 'Missing predictionId or statusUrl',
        code: 'VALIDATION',
      });
    }
    try {
      return await this.aiEngine.pollPrediction(dto);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ServiceUnavailableException({ error: message, code: 'UPSTREAM' });
    }
  }
}
