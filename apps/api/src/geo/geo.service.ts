import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { GeocodeResponseDto } from '@photoshop-lite/shared-types';
import { CacheService } from '../cache/cache.service';

const GEO_TTL_MS = 1000 * 60 * 60 * 24; // 24h

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  constructor(private readonly cache: CacheService) {}

  async reverse(lat: number, lon: number): Promise<GeocodeResponseDto> {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new BadRequestException('Invalid coordinates');
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new BadRequestException('Coordinates out of range');
    }

    const key = `geo:rev:${lat.toFixed(5)},${lon.toFixed(5)}`;
    return this.cache.wrap(key, () => this.fetchNominatim(lat, lon), GEO_TTL_MS);
  }

  private async fetchNominatim(lat: number, lon: number): Promise<GeocodeResponseDto> {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'json');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('zoom', '14');
    url.searchParams.set('addressdetails', '0');

    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'PhotoshopLite/1.0 (local-first photo editor; contact: local)',
      },
    });
    if (!res.ok) {
      this.logger.warn(`Nominatim HTTP ${res.status}`);
      return { label: null, latitude: lat, longitude: lon };
    }
    const data = (await res.json()) as { display_name?: string };
    return {
      label: data.display_name?.trim() || null,
      latitude: lat,
      longitude: lon,
      raw: data.display_name,
    };
  }
}
