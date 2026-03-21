import { TestBed } from '@angular/core/testing';
import { expect, describe, it, beforeEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { ValuesTable } from './values-table';
import type { ValueLens } from '../../services/wasm.service';

const SAMPLE_VALUES: ValueLens[] = [
  { position: 1, value: 1288459236, spell: 2065, chest: 36 },
  { position: 2, value: 2139177191, spell: 2262, chest: 91 },
  { position: 3, value: 74803024, spell: 2205, chest: 24 },
];

@Component({
  template: '<tza-values-table [values]="values()" />',
  imports: [ValuesTable],
})
class TestHost {
  values = signal<ValueLens[]>([]);
}

describe('ValuesTable', () => {
  let host: TestHost;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHost] }).compileComponents();
    const fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('renders no rows when values is empty', () => {
    expect(el.querySelectorAll('[data-testid="values-row"]').length).toBe(0);
  });

  it('renders a row for each value', async () => {
    host.values.set(SAMPLE_VALUES);
    await new Promise(r => setTimeout(r, 50));
    expect(el.querySelectorAll('[data-testid="values-row"]').length).toBe(3);
  });

  it('displays position, spell, and chest in each row', async () => {
    host.values.set(SAMPLE_VALUES);
    await new Promise(r => setTimeout(r, 50));
    const row = el.querySelector('[data-testid="values-row"]') as HTMLElement;
    expect(row.textContent).toContain('1');    // position
    expect(row.textContent).toContain('2065'); // spell
    expect(row.textContent).toContain('36');   // chest
  });

  it('shows column headers', () => {
    expect(el.textContent).toContain('Position');
    expect(el.textContent).toContain('Spell');
    expect(el.textContent).toContain('Chest %');
  });
});
