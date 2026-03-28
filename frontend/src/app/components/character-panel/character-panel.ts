import { ChangeDetectionStrategy, Component, linkedSignal, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { type Character } from '../../services/wasm.service';

export const DEFAULT_CHARACTER: Character = { level: 70, magic: 99, spell: 'Cure', serenity: true };

const SPELLS: Character['spell'][] = ['Cure', 'Cura', 'Curaga', 'Curaja'];

@Component({
  selector: 'tza-character-panel',
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule],
  templateUrl: './character-panel.html',
  styleUrl: './character-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharacterPanel {
  readonly character = model<Character>(DEFAULT_CHARACTER);

  readonly spells = SPELLS;

  // Local editable copies — reset whenever the model changes
  readonly level = linkedSignal(() => this.character().level);
  readonly magic = linkedSignal(() => this.character().magic);
  readonly spell = linkedSignal(() => this.character().spell);
  readonly serenity = linkedSignal(() => this.character().serenity);

  onLevelInput(event: Event): void {
    const n = parseInt((event.target as HTMLInputElement).value, 10);
    if (isNaN(n)) return;
    this.level.set(n);
    this.emit();
  }

  onMagicInput(event: Event): void {
    const n = parseInt((event.target as HTMLInputElement).value, 10);
    if (isNaN(n)) return;
    this.magic.set(n);
    this.emit();
  }

  onSpellChange(spell: Character['spell']): void {
    this.spell.set(spell);
    this.emit();
  }

  onSerenityChange(v: boolean): void {
    this.serenity.set(v);
    this.emit();
  }

  private emit(): void {
    this.character.set({
      level: this.level(),
      magic: this.magic(),
      spell: this.spell(),
      serenity: this.serenity(),
    });
  }
}
