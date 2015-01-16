var RequestFrame = require('raf')
var Dimensions = require('ainojs-dimensions')
var EventMixin = require('ainojs-events')

// shortcuts
var document = window.document
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

var Finger = function(elem, options) {

  if ( !(this instanceof Finger) )
    return new Finger(elem, options)

  // test for basic js support
  if ( 
    !document.addEventListener || 
    !Array.prototype.forEach || 
    !('contains' in document.body) ||
    !Function.prototype.bind ||
    !document.body.children
  ) return

  // default options
  this.config = {
    start: 0,
    duration: 600, // will decrease on smaller screens
    dbltap: true, // set to false for faster tap event if doubletap is not needed
    easing: function(x,t,b,c,d) {
      return -c * ((t=t/d-1)*t*t*t - 1) + b // easeOutQuart
    },
    bounceEasing: function (x, t, b, c, d, s) {
      if (s == undefined) s = 2.0158;
      return c*((t=t/d-1)*t*((s+1)*t + s) + 1) + b;
    }
  }

  this.inner = elem.children[0]

  if ( !this.inner )
    return

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
  bind(elem, 'touchstart', this.ontouchstart.bind(this))
  bind(window, 'resize', this.setup.bind(this))
  bind(window, 'orientationchange', this.setup.bind(this))
  bind(document, 'touchmove', this.ontouchmove.bind(this))
  bind(document, 'touchend', this.ontouchend.bind(this))

  // mixin events
  EventMixin.call(this)

  // set up width
  this.setup()
}

Finger.prototype.setup = function() {
  this.width = Dimensions( this.container ).width
  this.length = Math.ceil( Dimensions( this.inner ).width / this.width )
  if ( this.index !== 0 ) {
    this.index = this.validateIndex( this.index )
    this.pos = this.to = -this.width*this.index
  }
  this.loop()
}

Finger.prototype.destroy = function() {
  unbind(this.container, 'touchstart', this.ontouchstart)
  unbind(window, 'resize', this.setup)
  unbind(window, 'orientationchange', this.setup)
  unbind(document, 'touchmove', this.ontouchmove)
  unbind(document, 'touchend', this.ontouchend)
}

Finger.prototype.validateIndex = function(index) {
  return Math.min(this.length-1, Math.max(0, index))
}

Finger.prototype.ontouchstart = function(e) {

  var touch = e.touches

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
  this.deltaX = 0
  this.offset = 0

  if ( this.anim ) {
    this.to = this.pos
    this.offset = (this.pos + (this.width*this.index))
    this.anim = 0
  }

  this.loop()
}

Finger.prototype.ontouchmove = function(e) {

  if ( !this.touching )
    return

  // don’t swipe if zoomed
  if ( document.documentElement && Dimensions(document.documentElement).width / window.innerWidth > 1 )
    return

  var touch = e.touches

  // ensure swiping with one touch and not pinching
  if( touch && touch.length > 1 || e.scale && e.scale !== 1 ) return

  this.deltaX = touch[0].pageX - this.start.pageX + this.offset
  
  var dx = abs(touch[0].pageX - this.start.pageX)
  var dy = abs(touch[0].pageY - this.start.pageY)

  // determine if scrolling test has run - one time test
  if ( this.isScrolling === null ) {
    this.isScrolling = !!(
      this.isScrolling || dx < dy
    )
  }

  // save distance for tap event
  this.start.distance = Math.max( dx, dy )

  // clear old taps on move
  if ( this.start.distance > 2 ) {
    this.clearTap()
  }

  // if user is not trying to scroll vertically
  if (!this.isScrolling) {

    // prevent native scrolling
    e.preventDefault()
    this.start.prevent()

    // increase resistance if first or last slide
    this.deltaX /= ( (!this.index && this.deltaX > 0 || this.index == this.length - 1 && this.deltaX < 0 ) ?
       ( abs(this.deltaX) / this.width + 1.8 )  : 1 )
    this.to = this.deltaX - this.index * this.width

    // track the valocity
    var touch = e.touches

    tracker.push({
      pageX: touch[0].pageX - this.start.pageX,
      time: +new Date() - this.start.time
    })

    tracker = tracker.slice(-5)
  }

  e.stopPropagation()
}

Finger.prototype.ontouchend = function(e) {

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
        abs(this.deltaX) > 40 ||
        abs(this.deltaX) > this.width/2,

      isPastBounds = !this.index && this.deltaX > 0 ||
        this.index == this.length - 1 && this.deltaX < 0

  // if not scrolling vertically
  if ( !this.isScrolling ) {
    this.projection += ( isValidSlide && !isPastBounds ? 
      ((this.deltaX-this.offset) < 0 ? 1 : -1) : 0 )
    this.animateTo( this.projection )
  } else if ( this.offset )
    this.animateTo( this.index )
}

Finger.prototype.animateTo = function( index ) {
  index = this.validateIndex(index)
  this.to = -( index*this.width )
  this.index = this.projection = index
  this.loop()
},

Finger.prototype.jumpTo = function( index ) {
  index = this.validateIndex( index )
  if ( index !== this.index )
    this.trigger('complete', { index: index }, this)
  this.to = this.pos = -( index*this.width )
  this.index = this.projection = index
  this.loop()
},

Finger.prototype.loop = function() {

  var distance = this.to - this.pos

  // if distance is short or the user is touching, do a 1-1 animation
  if ( this.touching || abs(distance) <= 1 ) {
    this.pos = this.to
    if ( this.anim ) {
      this.index = this.projection = abs(Math.round(this.pos/this.width))
      this.trigger('complete', {index: this.index }, this)
    }
    this.anim = 0
  } else {

    if ( !this.anim ) {

      // save animation parameters
      // extract velocity first
      var velocity = 0.6
      var travel = this.width
      if ( tracker.length ) {
        var last = tracker[tracker.length-1]
        travel = (last.pageX - tracker[0].pageX)
        velocity = travel / (last.time - tracker[0].time)
        tracker = []
      }

      // detect bounce
      var isEdge = abs(this.start.pos) == abs(this.index*this.width)
      var bounce = !isEdge && abs(velocity) > 2.5 && abs(travel) / this.width > 0.35
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

  this.trigger('frame', {
    value: -this.pos/this.width,
    position: this.pos
  }, this)

  if ( this.touching || this.anim )
    RequestFrame(this.loop.bind(this))
}

module.exports = Finger