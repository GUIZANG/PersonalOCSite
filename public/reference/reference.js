/**
 * requestAnimationFrame
 */
window.requestAnimationFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          window.oRequestAnimationFrame      ||
          window.msRequestAnimationFrame     ||
          function (callback) {
              window.setTimeout(callback, 1000 / 60);
          };
})();


/**
* Returns a random number between min (inclusive) and max (exclusive)
*/
function random(min, max) { return Math.floor(Math.random() * (max - min) + min); }
function array_random(arr){ return arr[Math.floor(Math.random()*arr.length)]; }


/**
* Global config
*/
var Config = {
background : "#590000",
particleSpeed : 10,
};


/**
* Global vars
*/
var canvas, gui, context, layers = [];


/**
* Global initializer
*/
function init(){
canvas = document.getElementById('c');

//Init events
window.addEventListener('resize', onWindowResize, false);
onWindowResize(null);

//Init dat.gui
gui = new dat.GUI();
gui.addColor(Config, "background").onChange(function() {
  document.getElementsByTagName("body")[0].style.backgroundColor = Config.background;
});
gui.add(Config, "particleSpeed", 1, 20).step(1);
gui.close();

//Create layers
var layer1 = new ParallaxLayer(1, 4000, ["#830006","#680106","#63000b"], [50, 100], [10,20]); layer1.init(); layers.push(layer1);
var layer2 = new ParallaxLayer(1.2, 2000, ["#830006","#680106","#63000b"], [20,100], [10,20]); layer2.init(); layers.push(layer2);
var layer3 = new ParallaxLayer(1.4, 300, ["#dc0015","#e81227","#f21e33"], [5,100], [5,20]); layer3.init(); layers.push(layer3);

var dust1 = new ParallaxLayer(1.5, 1000, ["#e80742","#d5073d", "#ba0736"], [1,5], [1,5]); dust1.init(); layers.push(dust1);

var layer4 = new ParallaxLayer(1.6, 200, ["#e80742","#d5073d", "#ba0736"], [5,100], [5,20]); layer4.init(); layers.push(layer4);
var layer5 = new ParallaxLayer(1.8, 100, ["#e80742","#d5073d", "#ba0736"], [5,100], [1,20]); layer5.init(); layers.push(layer5);

var dust2 = new ParallaxLayer(1.9, 1000, ["#830006","#680106","#63000b"], [1,1], [1,1]); dust2.init(); layers.push(dust2);



update();
}


/**
* Global update
*/
function update(){
context.clearRect(0,0,canvas.width, canvas.height);
for(var i in layers) layers[i].update();
requestAnimationFrame(update);
}


/**
* Object : Particle
*/
function Particle(layerSpeed, colors, widthRange, heightRange){

this.init = function(reinit){
  this.x = (reinit) ? random(canvas.width, canvas.width * 2) : random(0, canvas.width * 2);
   this.y = random(0, canvas.height);
   this.width = random(widthRange[0], widthRange[1]);
   this.height = random(heightRange[0], heightRange[1]);
   this.color = array_random(colors);
};


this.update = function(){
  this.x-= Config.particleSpeed * layerSpeed;
  
  //Re-randomize positions & size to get a better efficiency
  if(this.x + this.width < 0){
    this.init(true);
    return;
  }
};

this.draw = function(){
   context.fillStyle = this.color;
  context.fillRect(this.x,this.y,this.width,this.height);
}
}


/** 
* Object : Parallax layer
*/
function ParallaxLayer(speed, count, colors, widthRange, heightRange){
this.particles = [];

this.init = function(){
  //Create particles
  for(var i = 0; i < count; i++){
     var particle = new Particle(speed, colors, widthRange, heightRange);
     particle.init();
     this.particles.push(particle);
   }
}


this.update = function(){
  for(var i in this.particles){
    this.particles[i].update();
    this.particles[i].draw();
  }
}
}


/**
* Event : onResize
*/
function onWindowResize(e) {
  screenWidth  = canvas.width  = window.innerWidth;
  screenHeight = canvas.height = window.innerHeight;

  centerX = screenWidth / 2;
  centerY = screenHeight / 2;

  context = canvas.getContext('2d');
}

init();