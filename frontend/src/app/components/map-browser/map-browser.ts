import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { type Observable } from 'rxjs';
import { TzaPanel } from '../tza-panel/tza-panel';
import { MapService, type MapChest, type MapData } from '../../services/map.service';

@Component({
  selector: 'tza-map-browser',
  imports: [TzaPanel],
  templateUrl: './map-browser.html',
  styleUrl: './map-browser.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapBrowser {
  private readonly mapService = inject(MapService);
  private readonly http = inject(HttpClient);

  readonly areas = this.mapService.areas;

  readonly selectedArea = signal<string | null>(null);
  readonly selectedSubArea = signal<string | null>(null);

  readonly subAreas = computed(() => {
    const slug = this.selectedArea();
    return this.areas().find((a) => a.slug === slug)?.sub_areas ?? [];
  });

  readonly mapData = rxResource<MapData, { area: string; subArea: string } | undefined>({
    params: () => {
      const area = this.selectedArea();
      const subArea = this.selectedSubArea();
      if (!area || !subArea) return undefined;
      return { area, subArea };
    },
    stream: ({ params: { area, subArea } }): Observable<MapData> =>
      this.http.get<MapData>(`/assets/maps/${area}/${subArea}.json`),
  });

  readonly imageUrl = computed(() => {
    const data = this.mapData.value();
    if (!data?.image) return null;
    return `/assets/maps/${this.selectedArea()}/${data.image}`;
  });

  readonly chestsWithPosition = computed(() =>
    (this.mapData.value()?.chests ?? []).filter(
      (c): c is MapChest & { position: NonNullable<MapChest['position']> } =>
        c.position != null,
    ),
  );

  readonly hasDA = computed(() =>
    (this.mapData.value()?.chests ?? []).some((c) => c.items_da?.length),
  );

  readonly hasTzaNote = computed(() =>
    (this.mapData.value()?.chests ?? []).some((c) => c.tza_note),
  );

  readonly gridCols = computed(() => {
    const cols = ['40px', '56px', '52px', '1fr'];
    if (this.hasDA()) cols.push('1fr');
    if (this.hasTzaNote()) cols.push('minmax(80px, 1fr)');
    return cols.join(' ');
  });

  onAreaChange(slug: string): void {
    this.selectedArea.set(slug || null);
    this.selectedSubArea.set(null);
  }

  onSubAreaChange(slug: string): void {
    this.selectedSubArea.set(slug || null);
  }
}
