import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';
import {
  RemoveBgRequestDto,
  RemoveBgResponseDto,
  UpscaleRequestDto,
  UpscaleResponseDto,
  PredictionPollRequestDto,
  PredictionPollResponseDto,
} from '@photoshop-lite/shared-types';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('remove-bg')
  removeBackground(@Body() body: RemoveBgRequestDto): Promise<RemoveBgResponseDto> {
    return this.aiService.removeBackground(body);
  }

  @Post('upscale')
  upscale(@Body() body: UpscaleRequestDto): Promise<UpscaleResponseDto> {
    return this.aiService.upscale(body);
  }

  @Post('prediction-status')
  predictionStatus(
    @Body() body: PredictionPollRequestDto
  ): Promise<PredictionPollResponseDto> {
    return this.aiService.pollPrediction(body);
  }
}
