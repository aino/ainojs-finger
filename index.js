var Dimensions = require('ainojs-dimensions')
var EventMixin = require('ainojs-events')

// shortcuts
var abs = Math.abs

// short event bindings
var bind = function(elem, type, handler) {
  elem.addEventListener(type, handler, false)
}
var unbind = function(elem, type, handler) {
  elem.removeEventListener(type, handler, false)
}

// track velocity
var tracker = []

module.exports = function(elem, options) {

  if ( !(this instanceof module.exports) )
    return new module.exports(elem, options)

  // test for basic js support
  if ( !this.support() )
    return

  // default options
  this.config = {
    start: 0,
    duration: 600, // will decrease on smaller screens
    mouse: true, // set to false if mouse interactions should be disabled
    dbltap: false, // set to true for for doubletap support
    easing: function(x,t,b,c,d) {
      return -c * ((t=t/d-1)*t*t*t - 1) + b // easeOutQuart
    },
    bounceEasing: function (x, t, b, c, d, s) {
      if (s == undefined) s = 2.0158;
      return c*((t=t/d-1)*t*((s+1)*t + s) + 1) + b;
    },
    items: null, // manually set number of items
    vertical: false // vertical instead of horizontal
  }

  this.inner = elem.children[0]

  if ( !this.inner ) {
    throw 'No inner element found'
    return
  }

  // extend options
  if ( options ) {
    for(var key in options) {
      this.config[key] = options[key]
    }
  }

  this.container = elem
  this.to = this.pos = 0
  this.touching = false
  this.start = {}
  this.index = this.projection = this.config.start
  this.anim = 0
  this.tap = 0
  this.clearTap = function() {
    if ( this.tap ) {
      window.clearTimeout(this.tap.timer)
      this.tap = 0
    }
  }.bind(this)

  // bind events
  bind(window, 'resize', this.setup.bind(this))
  bind(window, 'orientationchange', this.setup.bind(this))
  bind(elem, 'touchstart', this.ontouchstart.bind(this))
  bind(document, 'touchmove', this.ontouchmove.bind(this))
  bind(document, 'touchend', this.ontouchend.bind(this))

  if ( this.config.mouse ) {
    bind(elem, 'mousedown', this.ontouchstart.bind(this))
    bind(document, 'mousemove', this.ontouchmove.bind(this))
    bind(document, 'mouseup', this.ontouchend.bind(this))
  }


  // mixin events
  EventMixin.call(this)

  this.setup()

}

module.exports.prototype.support = function() {
  return (
    typeof window != 'undefined' &&
    document.addEventListener &&
    Array.prototype.forEach &&
    'contains' in document.body &&
    Function.prototype.bind &&
    document.body.children
  )
}

module.exports.prototype.setup = function() {
  var m = this.config.vertical ? 'height' : 'width'
  this.total = Dimensions( this.container )[m]
  this.length = typeof this.config.items == 'number' ? 
                this.config.items : 
                Math.ceil( Dimensions( this.inner )[m] / this.total )
  if ( this.index !== 0 ) {
    this.index = this.validateIndex( this.index )
    this.pos = this.to = -this.total*this.index
  }
  this.run()
}

module.exports.prototype.destroy = function() {
  unbind(window, 'resize', this.setup)
  unbind(window, 'orientationchange', this.setup)

  unbind(this.container, 'touchstart', this.ontouchstart)
  unbind(document, 'touchmove', this.ontouchmove)
  unbind(document, 'touchend', this.ontouchend)

  if ( this.config.mouse ) {
    unbind(elem, 'mousedown', this.ontouchstart)
    unbind(document, 'mousemove', this.ontouchmove)
    unbind(document, 'mouseup', this.ontouchend)
  }
}

module.exports.prototype.validateIndex = function(index) {
  return Math.min(this.length-1, Math.max(0, index))
}

module.exports.prototype.ontouchstart = function(e) {

  var touch = e.touches || [e]

  this.start = {
    pageX: touch[0].pageX,
    pageY: touch[0].pageY,
    time:  +new Date(),
    pos:   this.pos || 0,
    prevent: function() { e.preventDefault() },
    distance: 0,
    target: e.target
  }

  this.isScrolling = null
  this.touching = true
  this.delta = 0
  this.offset = 0

  if ( this.anim ) {
    this.to = this.pos
    this.offset = (this.pos + (this.total*this.index))
    this.anim = 0
  }

  this.run()
}

module.exports.prototype.ontouchmove = function(e) {

  if ( !this.touching )
    return

  var touch = e.touches || [e]

  // ensure swiping with one touch and not pinching
  if( touch && touch.length > 1 || e.scale && e.scale !== 1 ) return

  this.delta = this.config.vertical ? 
    touch[0].pageY - this.start.pageY + this.offset :
    touch[0].pageX - this.start.pageX + this.offset
  
  var dx = abs(touch[0].pageX - this.start.pageX)
  var dy = abs(touch[0].pageY - this.start.pageY)

  // determine if scrolling test has run - one time test
  if ( this.isScrolling === null ) {
    this.isScrolling = !!(this.isScrolling || ( this.config.vertical ? dy < dx : dx < dy))
  }

  // if user is not trying to scroll vertically
  if (!this.isScrolling) {

    // save distance for tap event
    this.start.distance = Math.max( dx, dy )

    // clear old taps on move
    if ( this.start.distance > 2 ) {
      this.clearTap()
    }

    // prevent native scrolling
    e.preventDefault()
    this.start.prevent()

    // increase resistance if first or last slide
    this.delta /= ( (!this.index && this.delta > 0 || this.index == this.length - 1 && this.delta < 0 ) ?
       ( abs(this.delta) / this.total + 1.8 )  : 1 )
    this.to = this.delta - this.index * this.total

    tracker.push({
      pageX: touch[0].pageX - this.start.pageX,
      pageY: touch[0].pageY - this.start.pageY,
      time: +new Date() - this.start.time
    })

    tracker = tracker.slice(-5)
  }

  e.stopPropagation()
}

module.exports.prototype.ontouchend = function(e) {

  if ( !this.touching )
    return

  this.touching = false

  // detect taps
  if ( this.start.distance < 2 && this.inner.contains( this.start.target ) ) {
    if ( !this.tap ) {
      if ( this.config.dbltap ) {
        this.tap = {
          time: +new Date(),
          pageX: this.start.pageX,
          pageY: this.start.pageY,
          timer: window.setTimeout(function() {
            this.trigger('tap', { target: this.start.target })
            this.tap = 0
          }.bind(this), 300)
        }
      } else {
        this.trigger('tap', { target: this.start.target })
      }
    } else {
      var tapDistance = Math.max(
        abs(this.tap.pageX - this.start.pageX),
        abs(this.tap.pageY - this.start.pageY)
      )
      if ( tapDistance < 100 )
        this.trigger('dbltap', { target: this.start.target })
      this.clearTap()
    }
  } else
    this.clearTap()

  // determine if slide attempt triggers next/prev slide
  var isValidSlide = +new Date() - this.start.time < 250 &&
        abs(this.delta) > 40 ||
        abs(this.delta) > this.total/2,

      isPastBounds = !this.index && this.delta > 0 ||
        this.index == this.length - 1 && this.delta < 0

  // if not scrolling
  if ( !this.isScrolling ) {
    this.projection += ( isValidSlide && !isPastBounds ? 
      ((this.delta-this.offset) < 0 ? 1 : -1) : 0 )
    this.animateTo( this.projection )
  } else if ( this.offset )
    this.animateTo( this.index )

  this.isScrolling = null
}

module.exports.prototype.animateTo = function( index ) {
  index = this.validateIndex(index)
  if (index !== this.index)
    this.trigger('page', { index: index }, this)
  this.to = -( index*this.total )
  this.index = this.projection = index
  this.run()
}

module.exports.prototype.jumpTo = function( index ) {
  index = this.validateIndex( index )
  if ( index !== this.index ) {
    this.trigger('page', { index: index }, this)
    this.trigger('complete', { index: index }, this)
  }
  this.to = this.pos = -( index*this.total )
  this.index = this.projection = index
  this.run(true)
}

module.exports.prototype.run = function(force) {

  var distance = this.to - this.pos
  var oldpos = this.pos

  // if distance is short or the user is touching, do a 1-1 animation
  if ( this.touching || abs(distance) <= 1 ) {
    this.pos = this.to
    if ( this.anim ) {
      this.index = this.projection = abs(Math.round(this.pos/this.total))
      this.trigger('complete', {index: this.index }, this)
    }
    this.anim = 0
  } else {
    if ( !this.anim ) {

      // save animation parameters
      // extract velocity first
      var velocity = 0.6
      var travel = this.total
      if ( tracker.length ) {
        var last = tracker[tracker.length-1]
        travel = this.config.vertical ? last.pageY - tracker[0].pageY : last.pageX - tracker[0].pageX
        velocity = travel / (last.time - tracker[0].time)
        tracker = []
      }

      // detect bounce
      var isEdge = abs(this.start.pos) == abs(this.index*this.total)
      var bounce = !isEdge && abs(velocity) > 2.5 && abs(travel) / this.total > 0.35
      var duration = this.config.duration
      if ( !isEdge )
        duration *= Math.min(1.2, Math.max(0.6, abs(distance/768))) // factorize 768

      this.anim = { 
        position: this.pos, 
        distance: distance,
        time: +new Date(), 
        duration: duration,
        easing: bounce ? this.config.bounceEasing : this.config.easing
      }
    }
    // apply easing
    this.pos = this.anim.easing(null, +new Date() - this.anim.time, this.anim.position, this.anim.distance, this.anim.duration)
  }
  if ( force === true || oldpos != this.pos ) {
    this.trigger('change', {
      value: -this.pos/this.total,
      position: this.pos
    }, this)
  }

  return this.anim || this.touching
}