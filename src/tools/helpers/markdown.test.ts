import { describe, it, expect } from 'vitest';
import { parseRichText } from './markdown';

describe('parseRichText', () => {
  it('should parse basic text', () => {
    const result = parseRichText('Hello world');
    expect(result).toHaveLength(1);
    expect(result[0].text.content).toBe('Hello world');
  });

  it('should parse simple link', () => {
    const result = parseRichText('[Google](https://google.com)');
    expect(result).toHaveLength(1);
    expect(result[0].text.content).toBe('Google');
    expect(result[0].text.link?.url).toBe('https://google.com');
  });

  it('should parse text with link', () => {
    const result = parseRichText('Click [here](url) to go');
    expect(result).toHaveLength(3);
    expect(result[0].text.content).toBe('Click ');
    expect(result[1].text.content).toBe('here');
    expect(result[1].text.link?.url).toBe('url');
    expect(result[2].text.content).toBe(' to go');
  });

  it('should handle brackets without parens', () => {
    const result = parseRichText('[Not a link]');
    expect(result).toHaveLength(1);
    expect(result[0].text.content).toBe('[Not a link]');
  });

  it('should handle brackets with space before paren', () => {
    const result = parseRichText('[Text] (url)');
    expect(result).toHaveLength(1);
    expect(result[0].text.content).toBe('[Text] (url)');
  });

  it('should handle nested brackets logic (inner bracket taken as text)', () => {
    // Current impl takes first ']'
    // [ [ ](url) -> Text: " [ " Url: "url"
    const result = parseRichText('[ [ ](url)');
    expect(result).toHaveLength(1);
    expect(result[0].text.content).toBe(' [ ');
    expect(result[0].text.link?.url).toBe('url');
  });

  it('should handle multiple links', () => {
    const result = parseRichText('[Link1](url1) and [Link2](url2)');
    expect(result).toHaveLength(3);
    expect(result[0].text.content).toBe('Link1');
    expect(result[2].text.content).toBe('Link2');
  });

  it('should handle no closing bracket', () => {
    const result = parseRichText('[Open forever');
    expect(result).toHaveLength(1);
    expect(result[0].text.content).toBe('[Open forever');
  });

  it('should handle multiple open brackets', () => {
    const result = parseRichText('[[[Text](url)');
    // First [ finds ] at index 7. (url) follows.
    // So it parses as link with text "[[Text".
    expect(result[0].text.content).toBe('[[Text');
    expect(result[0].text.link?.url).toBe('url');
  });
});
