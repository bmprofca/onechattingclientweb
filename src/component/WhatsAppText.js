import React from 'react';

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s]+/gi;
const TRAILING_PUNCTUATION = /[.,!?;:)\]}>"'”’]/;

function nextKey(keys) {
  keys.n += 1;
  return `wa-${keys.n}`;
}

function collectUrlRanges(text) {
  const ranges = [];
  const pattern = new RegExp(URL_PATTERN.source, 'gi');
  let match = pattern.exec(text);
  while (match) {
    let end = match.index + match[0].length;
    while (end > match.index && TRAILING_PUNCTUATION.test(text[end - 1])) end -= 1;
    if (end > match.index) ranges.push([match.index, end]);
    match = pattern.exec(text);
  }
  return ranges;
}

function indexInRanges(ranges, index) {
  return ranges.some(([start, end]) => index >= start && index < end);
}

function isOpenBoundary(text, index) {
  if (index <= 0) return true;
  return /[\s([{"'“‘]/.test(text[index - 1]);
}

function isCloseBoundary(text, index) {
  if (index >= text.length) return true;
  return /[\s.,!?;:)\]}"'”’]/.test(text[index]);
}

function findClose(text, from, marker, ranges) {
  for (let index = from; index < text.length; index += 1) {
    if (text[index] !== marker || indexInRanges(ranges, index)) continue;
    if (index === from || /\s/.test(text[index - 1])) continue;
    if (!isCloseBoundary(text, index + 1)) continue;
    return index;
  }
  return -1;
}

function wrap(type, children, key) {
  if (type === 'bold') return <strong key={key} className="font-semibold">{children}</strong>;
  if (type === 'italic') return <em key={key}>{children}</em>;
  if (type === 'strike') return <span key={key} className="line-through">{children}</span>;
  return (
    <code key={key} className="rounded bg-black/10 px-1 font-mono text-[0.92em] dark:bg-white/10">
      {children}
    </code>
  );
}

function linkify(text, keys, linkable) {
  if (!text) return [];
  const ranges = collectUrlRanges(text);
  if (ranges.length === 0) return [text];

  const nodes = [];
  let cursor = 0;
  ranges.forEach(([start, end]) => {
    if (start > cursor) nodes.push(text.slice(cursor, start));
    const url = text.slice(start, end);
    const href = /^www\./i.test(url) ? `https://${url}` : url;
    if (linkable) {
      nodes.push(
        <a
          key={nextKey(keys)}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-[#027eb5] underline decoration-[#027eb5]/70 underline-offset-2 dark:text-[#53bdeb] dark:decoration-[#53bdeb]/70"
          onClick={(event) => event.stopPropagation()}
        >
          {url}
        </a>
      );
    } else {
      nodes.push(url);
    }
    cursor = end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function parseSegment(text, keys, linkable) {
  const ranges = collectUrlRanges(text);
  const nodes = [];
  let plain = '';
  let index = 0;

  const flush = () => {
    if (!plain) return;
    nodes.push(...linkify(plain, keys, linkable));
    plain = '';
  };

  while (index < text.length) {
    if (!indexInRanges(ranges, index) && text.startsWith('```', index)) {
      const end = text.indexOf('```', index + 3);
      if (end > index + 3 && !indexInRanges(ranges, end)) {
        flush();
        nodes.push(wrap('mono', parseSegment(text.slice(index + 3, end), keys, linkable), nextKey(keys)));
        index = end + 3;
        continue;
      }
    }

    const marker = text[index];
    const type = marker === '*' ? 'bold' : marker === '_' ? 'italic' : marker === '~' ? 'strike' : null;
    if (type && !indexInRanges(ranges, index) && isOpenBoundary(text, index)) {
      const next = text[index + 1];
      if (next && !/\s/.test(next) && next !== marker) {
        const close = findClose(text, index + 1, marker, ranges);
        if (close !== -1) {
          flush();
          nodes.push(wrap(type, parseSegment(text.slice(index + 1, close), keys, linkable), nextKey(keys)));
          index = close + 1;
          continue;
        }
      }
    }

    plain += marker;
    index += 1;
  }

  flush();
  return nodes;
}

export default function WhatsAppText({ text, linkable = true }) {
  if (text == null || text === '') return null;
  return <>{parseSegment(String(text), { n: 0 }, linkable)}</>;
}
