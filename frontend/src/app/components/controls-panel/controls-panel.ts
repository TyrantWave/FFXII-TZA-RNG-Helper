import { Component, input, output, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { DEFAULT_SEED, type SearchStatus } from '../../services/wasm.service';

export type Mode = 'browse' | 'findSeed' | 'findPosition';

const OBSERVED_COUNT = 5;
const DEFAULT_MIN = 0;
const DEFAULT_MAX = 16_777_216;
const DEFAULT_ITERS = 100;

@Component({
  selector: 'app-controls-panel',
  imports: [MatButtonToggleModule, MatFormFieldModule, MatInputModule, MatButtonModule, FormsModule],
  templateUrl: './controls-panel.html',
  styleUrl: './controls-panel.scss',
})
export class ControlsPanel {
  readonly mode = input<Mode>('browse');
  readonly searchStatus = input<SearchStatus>('idle');

  readonly modeChange = output<Mode>();
  readonly browse = output<{ seed: number }>();
  readonly findSeed = output<{ values: number[]; min: number; max: number; iters: number }>();
  readonly findPosition = output<{ seed: number; values: number[] }>();

  // Browse state
  readonly browseSeed = signal(DEFAULT_SEED);

  // Find seed state
  readonly observedValues = signal<(number | null)[]>(Array(OBSERVED_COUNT).fill(null));
  readonly findSeedMin = signal(DEFAULT_MIN);
  readonly findSeedMax = signal(DEFAULT_MAX);
  readonly findSeedIters = signal(DEFAULT_ITERS);

  // Find position state
  readonly findPosSeed = signal(DEFAULT_SEED);
  readonly findPosValues = signal<(number | null)[]>(Array(OBSERVED_COUNT).fill(null));

  readonly observedIndices = Array.from({ length: OBSERVED_COUNT }, (_, i) => i);

  readonly statusLabel: Record<SearchStatus, string> = {
    idle: '',
    searching: 'Searching…',
    found: 'Found',
    notfound: 'Not found',
  };

  onModeChange(mode: Mode): void {
    this.modeChange.emit(mode);
  }

  onBrowseLoad(): void {
    this.browse.emit({ seed: this.browseSeed() });
  }

  onFindSeedSubmit(): void {
    const values = this.observedValues().filter((v): v is number => v !== null);
    this.findSeed.emit({
      values,
      min: this.findSeedMin(),
      max: this.findSeedMax(),
      iters: this.findSeedIters(),
    });
  }

  onFindPositionSubmit(): void {
    const values = this.findPosValues().filter((v): v is number => v !== null);
    this.findPosition.emit({ seed: this.findPosSeed(), values });
  }

  setObservedValue(index: number, raw: string): void {
    const n = raw === '' ? null : parseInt(raw, 10);
    const updated = [...this.observedValues()];
    updated[index] = isNaN(n as number) ? null : n;
    this.observedValues.set(updated);
  }

  setFindPosValue(index: number, raw: string): void {
    const n = raw === '' ? null : parseInt(raw, 10);
    const updated = [...this.findPosValues()];
    updated[index] = isNaN(n as number) ? null : n;
    this.findPosValues.set(updated);
  }
}
