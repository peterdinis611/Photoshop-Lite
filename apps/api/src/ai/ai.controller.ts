import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';
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

  @Post('cleanup')
  cleanup(@Body() body: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.aiService.cleanup(body);
  }

  @Post('revive')
  revive(@Body() body: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.aiService.revive(body);
  }

  @Post('face-restore')
  faceRestore(@Body() body: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.aiService.faceRestore(body);
  }

  @Post('inpaint')
  inpaint(@Body() body: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.aiService.inpaint(body);
  }

  @Post('object-remove')
  objectRemove(@Body() body: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.aiService.objectRemove(body);
  }

  @Post('outpaint')
  outpaint(@Body() body: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.aiService.outpaint(body);
  }

  @Post('style')
  style(@Body() body: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.aiService.style(body);
  }

  @Post('relight')
  relight(@Body() body: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.aiService.relight(body);
  }

  @Post('segment')
  segment(@Body() body: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.aiService.segment(body);
  }

  @Post('caption')
  caption(@Body() body: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.aiService.caption(body);
  }
}
