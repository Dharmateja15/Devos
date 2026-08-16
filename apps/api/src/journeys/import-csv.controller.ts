import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { IsString, IsNotEmpty } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ImportCsvService } from './import-csv.service';

export class ExecuteCsvDto {
  @IsString()
  @IsNotEmpty()
  previewToken: string;
}

@UseGuards(JwtAuthGuard)
@Controller('api/v1/journeys')
export class ImportCsvController {
  constructor(private readonly importCsvService: ImportCsvService) {}

  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Post(':journeyId/import/csv/preview')
  @UseInterceptors(FileInterceptor('file'))
  async preview(
    @CurrentUser() user: any,
    @Param('journeyId') journeyId: string,
    @UploadedFile() file?: { buffer: Buffer; originalname?: string },
    @Body() body?: any,
  ) {
    let csvContent: string | null = null;

    if (file) {
      if ((file as any).buffer && Buffer.isBuffer((file as any).buffer)) {
        csvContent = (file as any).buffer.toString('utf-8');
      } else if (typeof file === 'string') {
        csvContent = file;
      } else if (typeof (file as any).file === 'string') {
        csvContent = (file as any).file;
      } else if (typeof (file as any).csv === 'string') {
        csvContent = (file as any).csv;
      }
    }

    if (!csvContent && body) {
      if (typeof body === 'string') {
        csvContent = body;
      } else if (typeof body.file === 'string') {
        csvContent = body.file;
      } else if (typeof body.csv === 'string') {
        csvContent = body.csv;
      } else if (body.buffer && Buffer.isBuffer(body.buffer)) {
        csvContent = body.buffer.toString('utf-8');
      }
    }

    if (!csvContent) {
      throw new BadRequestException('CSV file is required');
    }

    return this.importCsvService.previewCsv(user.id, journeyId, csvContent);
  }

  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Post(':journeyId/import/csv/execute')
  async execute(
    @CurrentUser() user: any,
    @Param('journeyId') journeyId: string,
    @Body() body: ExecuteCsvDto,
  ) {
    if (!body || !body.previewToken) {
      throw new BadRequestException('previewToken is required');
    }

    return this.importCsvService.executeCsv(
      user.id,
      journeyId,
      body.previewToken,
    );
  }
}
