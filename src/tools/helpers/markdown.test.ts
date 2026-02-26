import { describe, it, expect } from 'vitest';
import { parseRichText, extractPlainText } from './markdown';

describe('parseRichText', () => {
  it('should parse plain text', () => {
    const text = 'Hello world';
    const result = parseRichText(text);
    expect(result).toHaveLength(1);
    expect(result[0].text.content).toBe('Hello world');
    expect(result[0].annotations.bold).toBe(false);
  });

  it('should parse bold text', () => {
    const text = 'Hello **world**';
    const result = parseRichText(text);
    expect(result).toHaveLength(2);
    expect(result[0].text.content).toBe('Hello ');
    expect(result[1].text.content).toBe('world');
    expect(result[1].annotations.bold).toBe(true);
    // No trailing empty string
  });

  it('should parse italic text', () => {
    const text = '*Italic*';
    const result = parseRichText(text);
    expect(result[0].text.content).toBe('Italic');
    expect(result[0].annotations.italic).toBe(true);
  });

  it('should parse links', () => {
    const text = 'Click [here](https://example.com)';
    const result = parseRichText(text);
    expect(result).toHaveLength(2); // "Click " + "here"
    expect(result[0].text.content).toBe('Click ');
    expect(result[1].text.content).toBe('here');
    expect(result[1].text.link?.url).toBe('https://example.com');
  });

  it('should handle mixed formatting', () => {
    const text = '**Bold** and *Italic* with [Link](url)';
    const result = parseRichText(text);
    const plain = extractPlainText(result);
    expect(plain).toBe('Bold and Italic with Link');
  });

  it('should handle nested brackets that are not links', () => {
    const text = '[Not a link]';
    const result = parseRichText(text);
    expect(result[0].text.content).toBe('[Not a link]');
    expect(result[0].text.link).toBeNull();
  });

  it('should handle incomplete links', () => {
    const text = '[Incomplete](url';
    const result = parseRichText(text);
    expect(result[0].text.content).toBe('[Incomplete](url');
  });

  it('should handle multiple links', () => {
     const text = '[Link1](url1) and [Link2](url2)';
     const result = parseRichText(text);
     expect(result.length).toBeGreaterThanOrEqual(3);
     const links = result.filter(r => r.text.link);
     expect(links).toHaveLength(2);
     expect(links[0].text.content).toBe('Link1');
     expect(links[0].text.link?.url).toBe('url1');
     expect(links[1].text.content).toBe('Link2');
     expect(links[1].text.link?.url).toBe('url2');
  });

  it('should be performant with many open brackets', () => {
     const n = 10000;
     const text = '['.repeat(n);
     const start = performance.now();
     parseRichText(text);
     const end = performance.now();
     expect(end - start).toBeLessThan(100); // Expect < 100ms
  });
});
