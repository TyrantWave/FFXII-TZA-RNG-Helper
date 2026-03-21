import { TestBed } from '@angular/core/testing';
import { expect, describe, it, beforeEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CharacterPanel } from './character-panel';
import type { Character } from '../../services/wasm.service';

const DEFAULT: Character = { level: 70, magic: 99, spell: 'Cure', serenity: true };

@Component({
  template: `<tza-character-panel
    [character]="character()"
    (characterChange)="onChange($event)"
  />`,
  imports: [CharacterPanel],
})
class TestHost {
  character = signal<Character>(DEFAULT);
  lastEmit: Character | null = null;
  onChange(c: Character) { this.lastEmit = c; }
}

describe('CharacterPanel', () => {
  let host: TestHost;
  let el: HTMLElement;
  let fixture: ReturnType<typeof TestBed.createComponent<TestHost>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost, NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('renders level input with current value', () => {
    const input = el.querySelector<HTMLInputElement>('[data-testid="level-input"]');
    expect(input).toBeTruthy();
    expect(input!.value).toBe('70');
  });

  it('renders magic input with current value', () => {
    const input = el.querySelector<HTMLInputElement>('[data-testid="magic-input"]');
    expect(input).toBeTruthy();
    expect(input!.value).toBe('99');
  });

  it('emits characterChange with updated level', async () => {
    const input = el.querySelector<HTMLInputElement>('[data-testid="level-input"]')!;
    input.value = '50';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.lastEmit?.level).toBe(50);
  });

  it('emits characterChange with updated magic', async () => {
    const input = el.querySelector<HTMLInputElement>('[data-testid="magic-input"]')!;
    input.value = '80';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.lastEmit?.magic).toBe(80);
  });

  it('renders spell selector', () => {
    expect(el.querySelector('[data-testid="spell-select"]')).toBeTruthy();
  });

  it('renders serenity toggle', () => {
    expect(el.querySelector('[data-testid="serenity-toggle"]')).toBeTruthy();
  });

  it('reflects updated character input', async () => {
    host.character.set({ ...DEFAULT, level: 30, magic: 40 });
    fixture.detectChanges();
    await fixture.whenStable();
    const levelInput = el.querySelector<HTMLInputElement>('[data-testid="level-input"]')!;
    const magicInput = el.querySelector<HTMLInputElement>('[data-testid="magic-input"]')!;
    expect(levelInput.value).toBe('30');
    expect(magicInput.value).toBe('40');
  });
});
