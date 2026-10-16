'use strict';

// Bağımlılıksız, yalnızca src/inject.js'in kullandığı DOM API'lerini taklit eden
// küçük bir DOM. Seçiciler: etiket, .sınıf, [a], [a="v"], [a*="v"], virgül ve
// iki parçalı alt öğe birleşimi ("a[href*=x] time").

class Text {
  constructor(text) {
    this.nodeType = 3;
    this.data = String(text);
    this.parentElement = null;
  }
  get textContent() {
    return this.data;
  }
}

class Style {
  constructor() {
    this._p = new Map();
  }
  setProperty(k, v) {
    this._p.set(k, String(v));
  }
  getPropertyValue(k) {
    return this._p.get(k) || '';
  }
  removeProperty(k) {
    this._p.delete(k);
  }
}

function parseCompound(sel) {
  const parts = { tag: null, classes: [], attrs: [] };
  let rest = sel;
  const tag = /^[a-zA-Z][\w-]*/.exec(rest);
  if (tag) {
    parts.tag = tag[0].toUpperCase();
    rest = rest.slice(tag[0].length);
  }
  while (rest) {
    let m;
    if ((m = /^\.([\w-]+)/.exec(rest))) parts.classes.push(m[1]);
    else if ((m = /^\[([\w-]+)(?:(\*?=)"([^"]*)")?\]/.exec(rest))) parts.attrs.push([m[1], m[2] || null, m[3]]);
    else throw new Error('desteklenmeyen seçici: ' + sel);
    rest = rest.slice(m[0].length);
  }
  return parts;
}

function matchCompound(el, c) {
  if (el.nodeType !== 1) return false;
  if (c.tag && el.tagName !== c.tag) return false;
  for (const cl of c.classes) if (!el.classList.contains(cl)) return false;
  for (const [name, op, val] of c.attrs) {
    if (!el.hasAttribute(name)) return false;
    const v = el.getAttribute(name);
    if (op === '=' && v !== val) return false;
    if (op === '*=' && !v.includes(val)) return false;
  }
  return true;
}

function matchSelector(el, selector, scope) {
  return selector.split(',').some((part) => {
    const chain = part.trim().split(/\s+/).map(parseCompound);
    if (!matchCompound(el, chain[chain.length - 1])) return false;
    let i = chain.length - 2;
    let p = el.parentElement;
    while (i >= 0 && p && p !== scope) {
      if (matchCompound(p, chain[i])) i--;
      p = p.parentElement;
    }
    return i < 0;
  });
}

class Element {
  constructor(tag, doc) {
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.ownerDocument = doc;
    this.childNodes = [];
    this.parentElement = null;
    this._attrs = new Map();
    this._listeners = {};
    this.style = new Style();
  }
  get children() {
    return this.childNodes.filter((n) => n.nodeType === 1);
  }
  get id() {
    return this.getAttribute('id') || '';
  }
  set id(v) {
    this.setAttribute('id', v);
  }
  get className() {
    return this.getAttribute('class') || '';
  }
  set className(v) {
    this.setAttribute('class', v);
  }
  get classList() {
    const el = this;
    return {
      contains: (c) => el.className.split(/\s+/).includes(c),
      add: (c) => {
        if (!this.classList.contains(c)) el.className = (el.className + ' ' + c).trim();
      },
    };
  }
  setAttribute(k, v) {
    this._attrs.set(k, String(v));
  }
  getAttribute(k) {
    return this._attrs.has(k) ? this._attrs.get(k) : null;
  }
  hasAttribute(k) {
    return this._attrs.has(k);
  }
  removeAttribute(k) {
    this._attrs.delete(k);
  }
  get textContent() {
    return this.childNodes.map((n) => n.textContent).join('');
  }
  set textContent(v) {
    this.childNodes.forEach((n) => (n.parentElement = null));
    this.childNodes = [];
    this.append(String(v));
  }
  append(...nodes) {
    for (let n of nodes) {
      if (typeof n === 'string') n = new Text(n);
      if (n.parentElement) n.remove();
      n.parentElement = this;
      this.childNodes.push(n);
    }
  }
  appendChild(n) {
    this.append(n);
    return n;
  }
  insertBefore(n, ref) {
    if (n.parentElement) n.remove();
    const i = this.childNodes.indexOf(ref);
    if (i < 0) throw new Error('referans düğüm bu öğenin çocuğu değil');
    n.parentElement = this;
    this.childNodes.splice(i, 0, n);
    return n;
  }
  remove() {
    const p = this.parentElement;
    if (!p) return;
    p.childNodes.splice(p.childNodes.indexOf(this), 1);
    this.parentElement = null;
  }
  get previousElementSibling() {
    const sibs = this.parentElement ? this.parentElement.children : [];
    return sibs[sibs.indexOf(this) - 1] || null;
  }
  get nextElementSibling() {
    const sibs = this.parentElement ? this.parentElement.children : [];
    const i = sibs.indexOf(this);
    return i >= 0 ? sibs[i + 1] || null : null;
  }
  *_descendants() {
    for (const c of this.children) {
      yield c;
      yield* c._descendants();
    }
  }
  querySelectorAll(sel) {
    const out = [];
    for (const d of this._descendants()) if (matchSelector(d, sel, this)) out.push(d);
    return out;
  }
  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }
  matches(sel) {
    return matchSelector(this, sel, null);
  }
  closest(sel) {
    for (let e = this; e; e = e.parentElement) if (matchSelector(e, sel, null)) return e;
    return null;
  }
  addEventListener(type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  }
  dispatch(type, extra) {
    let stopped = false;
    const ev = Object.assign(
      {
        type,
        target: this,
        preventDefault() {},
        stopPropagation() {
          stopped = true;
        },
      },
      extra
    );
    for (let e = this; e && !stopped; e = e.parentElement) {
      for (const fn of e._listeners[type] || []) fn.call(e, ev);
    }
  }
  click() {
    this.dispatch('click');
  }
}

class Document {
  constructor() {
    this.cookie = '';
    this.documentElement = new Element('html', this);
    this.head = new Element('head', this);
    this.body = new Element('body', this);
    this.documentElement.append(this.head, this.body);
  }
  createElement(tag) {
    return new Element(tag, this);
  }
  getElementById(id) {
    return this.documentElement.querySelectorAll('[id="' + id + '"]')[0] || null;
  }
  querySelectorAll(sel) {
    return this.documentElement.querySelectorAll(sel);
  }
  querySelector(sel) {
    return this.documentElement.querySelector(sel);
  }
  addEventListener() {}
}

// h('div', {attrs}, ...children) kısayolu
function h(doc, tag, attrs, ...kids) {
  const el = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  el.append(...kids);
  return el;
}

module.exports = { Document, Element, h };
