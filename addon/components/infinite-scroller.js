import Ember from 'ember';
import Component from 'ember-component';
import layout from '../templates/components/infinite-scroller';
import { guidFor } from 'ember-metal/utils';
import { bind, debounce } from 'ember-runloop';
import RSVP from 'rsvp';
import inject from 'ember-service/inject';
const { round } = Math;

export default Component.extend({
  layout,
  hasMore: true,
  classNames: ['infinite-scroller'],
  classNameBindings: ['isLoading'],


  getScrollParents(el) {
    // In firefox if the el is inside an iframe with display: none; window.getComputedStyle() will return null;
    // https://bugzilla.mozilla.org/show_bug.cgi?id=548397
    var computedStyle = getComputedStyle(el) || {};
    var position = computedStyle.position;
    var parents = [];

    if (position === 'fixed') {
      return [el];
    }

    var parent = el;
    while ((parent = parent.parentNode) && parent && parent.nodeType === 1) {
      var style = undefined;
      try {
        style = getComputedStyle(parent);
      } catch (err) {}

      if (typeof style === 'undefined' || style === null) {
        parents.push(parent);
        return parents;
      }

      var _style = style;
      var overflow = _style.overflow;
      var overflowX = _style.overflowX;
      var overflowY = _style.overflowY;

      if (/(auto|scroll)/.test(overflow + overflowY + overflowX)) {
        if (position !== 'absolute' || ['relative', 'absolute', 'fixed'].indexOf(style.position) >= 0) {
          parents.push(parent);
        }
      }
    }

    parents.push(document);
    return parents;
  },

  _infiniteScroller: inject('-infinite-scroller'),

  init() {
    this._super(...arguments);
    this.set('scrollEventName', 'scroll.' + guidFor(this));

  },

  useDocument: Ember.computed('scollElement', function() {
    let ele = this.get('scollElement');
    return ele && ele === document;
  }),

  didInsertElement() {
    this._super(...arguments);

    let parents = this.getScrollParents(this.get('element'));
    this.$scollElement = Ember.$(parents[0]);
    this.set('scollElement', parents[0]);

    this.$scroller().on(this.get('scrollEventName'), args => {
      debounce(this, '_scrollingElement', args, this._scrollDebounce());
    });
  },

  willDestroyElement() {
    this._super(...arguments);
    this.$scroller().off(this.get('scrollEventName'));
  },

  _scrollDebounce() {
    return this.getAttr('scroll-debounce') || 100;
  },

  $scroller() {
    return this.$scollElement;
  },

  _scrollerHeight() {
    if (this.get('useDocument')) {
      return Ember.$(window).height();
    } else {
      return this.$scroller().outerHeight();
    }
  },

  _scrollableHeight() {
    let element = this.$scollElement.get(0);
    return element.scrollHeight || this.$scollElement.outerHeight();
  },

  _scrollTop() {
    return this.$scollElement.scrollTop();
  },

  _scrollerBottom() {
    return this._scrollableHeight() - this._scrollerHeight();
  },

  _scrollPercentage() {
    return round(this._scrollTop() / this._scrollerBottom() * 100);
  },

  _triggerAt() {
    return parseInt(this.getAttr('trigger-at') || '100%', 10);
  },

  _reachedBottom() {
    return this._scrollPercentage() >= this._triggerAt();
  },

  _shouldLoadMore() {
    return this.get('hasMore') && this._reachedBottom() && !this.get('isLoading');
  },

  _scrollingElement() {
    if (this._shouldLoadMore()) {
      this._loadMore();
    }
  },

  _loadMore() {
    this.set('error', null);
    this.set('isLoading', true);
    RSVP.resolve(this.getAttr('on-load-more')())
      .catch(bind(this, '_loadError'))
      .finally(bind(this, '_loadFinished'));
  },

  _loadError(error) {
    if (this.get('isDestroyed')) {
      return;
    }
    this.set('error', error);
  },

  _loadFinished() {
    if (this.get('isDestroyed')) {
      return;
    }
    this.set('isLoading', false);
  },

  actions: {
    loadMore() {
      this._loadMore();
    }
  }
});
