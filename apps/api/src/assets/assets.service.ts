import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AssetResponseDto, AssetUploadDto } from '@photoshop-lite/shared-types';
import { assetsRoot, ensureDir, newId } from '../common/data-paths';

interface AssetIndexEntry {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  storedName: string;
  createdAt: string;
}

@Injectable()
export class AssetsService {
  private indexPath(): string {
    return path.join(assetsRoot(), 'index.json');
  }

  private readIndex(): AssetIndexEntry[] {
    const file = this.indexPath();
    if (!fs.existsSync(file)) return [];
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8')) as AssetIndexEntry[];
    } catch {
      return [];
    }
  }

  private writeIndex(entries: AssetIndexEntry[]): void {
    ensureDir(assetsRoot());
    fs.writeFileSync(this.indexPath(), JSON.stringify(entries, null, 2), 'utf8');
  }

  private extFromMime(mime: string): string {
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
    if (mime.includes('webp')) return 'webp';
    if (mime.includes('gif')) return 'gif';
    return 'png';
  }

  upload(dto: AssetUploadDto): AssetResponseDto {
    if (!dto?.dataBase64) {
      throw new BadRequestException({ error: 'Missing dataBase64', code: 'VALIDATION' });
    }

    const match = dto.dataBase64.match(/^data:([^;]+);base64,(.+)$/);
    const mimeType = dto.mimeType || match?.[1] || 'image/png';
    const b64 = match?.[2] || dto.dataBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(b64, 'base64');
    if (buffer.length === 0) {
      throw new BadRequestException({ error: 'Empty asset payload', code: 'VALIDATION' });
    }

    const id = newId('asset');
    const ext = this.extFromMime(mimeType);
    const fileName = dto.fileName?.trim() || `upload.${ext}`;
    const storedName = `${id}.${ext}`;
    const filePath = path.join(assetsRoot(), storedName);
    fs.writeFileSync(filePath, buffer);

    const entry: AssetIndexEntry = {
      id,
      fileName,
      mimeType,
      size: buffer.length,
      storedName,
      createdAt: new Date().toISOString(),
    };

    const index = this.readIndex();
    index.unshift(entry);
    this.writeIndex(index);

    return {
      id: entry.id,
      fileName: entry.fileName,
      mimeType: entry.mimeType,
      size: entry.size,
      url: `/api/assets/${entry.id}`,
      createdAt: entry.createdAt,
    };
  }

  list(): AssetResponseDto[] {
    return this.readIndex().map((e) => ({
      id: e.id,
      fileName: e.fileName,
      mimeType: e.mimeType,
      size: e.size,
      url: `/api/assets/${e.id}`,
      createdAt: e.createdAt,
    }));
  }

  getFile(id: string): { stream: StreamableFile; mimeType: string; fileName: string } {
    const entry = this.readIndex().find((e) => e.id === id);
    if (!entry) {
      throw new NotFoundException({ error: `Asset ${id} not found`, code: 'NOT_FOUND' });
    }
    const filePath = path.join(assetsRoot(), entry.storedName);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException({ error: `Asset file missing`, code: 'NOT_FOUND' });
    }
    const stream = new StreamableFile(fs.createReadStream(filePath), {
      type: entry.mimeType,
      disposition: `inline; filename="${entry.fileName}"`,
    });
    return { stream, mimeType: entry.mimeType, fileName: entry.fileName };
  }
}
