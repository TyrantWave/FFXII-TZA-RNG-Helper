import { computed, inject, Injectable } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';

export interface SubAreaEntry {
  slug: string;
  name: string;
}

export interface AreaEntry {
  slug: string;
  name: string;
  sub_areas: SubAreaEntry[];
}

export interface MapChest {
  id: number;
  respawn: boolean;
  spawn_pct: number;
  gil_pct: number;
  gil_max: number;
  items: string[];
  items_da?: string[];
  tza_note?: string | null;
  position?: { x: number; y: number };
}

export interface MapData {
  area: string;
  sub_area: string;
  image: string;
  chests: MapChest[];
}

@Injectable({ providedIn: 'root' })
export class MapService {
  private readonly http = inject(HttpClient);

  readonly indexResource = rxResource<AreaEntry[], void>({
    stream: () => this.http.get<AreaEntry[]>('/assets/maps/index.json'),
  });

  readonly areas = computed(() => this.indexResource.value() ?? []);
}
