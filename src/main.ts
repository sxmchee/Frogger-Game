import "./style.css";
import { fromEvent, interval, merge} from 'rxjs'; 
import { map, filter, scan} from 'rxjs/operators';


function main() {
  // references used for keyboard events
  type Key = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'KeyR'
  type Event = 'keydown' 
  // references used to determine frogger object types (useful for identification purposes later when object is passed into a function)
  type ViewType = 'frog' | 'cars' | 'logs' | 'turtles' | 'fly' | 'lilypads' | 'dummyfrog'

  // references used for state
  type State = Readonly<{
    time: number,
    lilypads: ReadonlyArray<FroggerObjects>,
    frog: FroggerObjects,
    fly: FroggerObjects,
    cars: ReadonlyArray<FroggerObjects>,
    logs: ReadonlyArray<FroggerObjects>,
    turtles: ReadonlyArray<FroggerObjects>,
    gameOver: boolean,
    destination: ReadonlyArray<FroggerObjects>,
    restart: boolean,
    lives: number,
    currentScore: number,
    highScore: number,
    gameSpeed: number
  }>

  // reference used when creating frogger objects
  type Rect = Readonly<{height:number, width:number}>
  type ObjectId = Readonly<{id:string, createTime:number}>
  interface IObject extends Rect, ObjectId {
    pos: Position,
    viewType: ViewType,
    frameX: number,
    frameY: number,
    displacement: number,
    axis: string,
    risingTurtles: boolean,
    risingTurtlesFrame: boolean,
    condition: boolean
  }

  type FroggerObjects = Readonly<IObject>

  // some constants regarding the game 
  const Constants = {
    CanvasSize:600,
    StartCarsCount:8,
    StartLogsCount:4,
    StartTurtlesCount:10,
    StartLilyPadsCount:5,
    JumpDistance: 70,
    StartTime: 0
  } as const
  
  // unique classes used to simulate events 
  // a specific class is created based on a specific keyboard event
  class Tick { constructor(public readonly elapsed:number) {} }
  class Jump{ constructor(public readonly direction:number, public readonly axis: string, public readonly frame: number) {} }
  class Restart {constructor(public readonly restart: boolean){}}
  // a Position class for storing position
  class Position {constructor(public readonly x: number, public readonly y: number) {}}

  // generalise all frogger objects as a rectangle object
  const createRectangles = (viewType: ViewType)=> (rect:Rect)=> (axis:string) => (pos:Position)=> (dis:number) => (oid:ObjectId) =>
  <FroggerObjects>{
    ...rect,
    ...oid,
    pos: pos,
    frameX: 0,
    frameY: 0,
    displacement: dis,
    id: viewType+oid.id,
    viewType: viewType,
    axis: axis,
    risingTurtles: false,
    risingTurtlesFrame: false,
    condition: true
  },

  // initialise all functions related to creating frogger objects as some values can be predetermined
  createFrog = createRectangles('frog')({height:45, width:45})("x")(new Position(275, 540))(0),
  createCars = createRectangles('cars')({height:65, width:180})("x"),
  createLogs = createRectangles('logs')({height:55, width:200})("x"),
  createTurtles = createRectangles('turtles')({height:55, width:55})("x"),
  createFly = createRectangles('fly')({height:50, width:40})("null"),
  createLilyPads = createRectangles('lilypads')({height:50, width:40})("null"),
  createDummyFrog = createRectangles('dummyfrog'),

  // gameClock is a stream that outputs the game time
  // keyObservable is a stream that outputs classes based keyboard events
  gameClock = interval(10).pipe(map(elapsed=>new Tick(elapsed))),
  keyObservable = <T>(e:Event, k:Key, result:()=>T)=>
              fromEvent<KeyboardEvent>(document,e)
              .pipe(filter(({code})=>code === k),
              filter(({repeat})=>!repeat),
              map(result))

  const jumpLeft = keyObservable('keydown','ArrowLeft',()=>new Jump(-1, "x", 2)),
        jumpRight = keyObservable('keydown','ArrowRight',()=>new Jump(1, "x", 1)),
        jumpUp = keyObservable('keydown','ArrowUp',()=>new Jump(-1, "y", 0)),
        jumpDown = keyObservable('keydown','ArrowDown',()=>new Jump(1, "y", 3)),
        restart = keyObservable('keydown', 'KeyR', ()=>new Restart(true)),

        // create car frogger objects, splitting all cars into 3 different lanes
        // speed, lane position and distance between cars are predetermined
        // all cars object are stored in an array via mapping empty objects to the createCars function
        createAllCars = [...Array(Constants.StartCarsCount)]
        .map((_,i)=> i < 3 ? createCars(new Position(-100 + i*-290, 470))(1)
                              ({id:String(i),createTime:Constants.StartTime}): 
                     i < 5 ? createCars(new Position(600 + i*350, 392.5))(-2)
                              ({id:String(i),createTime:Constants.StartTime}):
                              createCars(new Position(-100 + i*-300, 316))(1.5)
                              ({id:String(i),createTime:Constants.StartTime})),
                              
        // create logs frogger objects
        // all logs object are stored in an array via mapping empty objects to the createLogs function
        createAllLogs = [...Array(Constants.StartLogsCount)]
        .map((_,i)=> createLogs(new Position(600 + i*300, 120))(-0.5)
                      ({id:String(i),createTime:Constants.StartTime})),

        // create turtles frogger objects, splitting all turtles into 2 different lanes
        // all turtles object are stored in an array via mapping empty objects to the createTurtles function
        createAllTurtles = [...Array(Constants.StartTurtlesCount)]
        .map((_,i)=> i < 5 ? createTurtles(new Position(-100 + i*-200, 182.5))(0.8)
                              ({id:String(i),createTime:Constants.StartTime}):
                             createTurtles(new Position(-200 + i*200, 60))(0.8)
                              ({id:String(i),createTime:Constants.StartTime})), 
        
        // create lilypads frogger objects
        // all lilypads object are stored in an array via mapping empty objects to the createLilyPads function
        createAllLilyPads = [...Array(Constants.StartLilyPadsCount)]
        .map((_,i)=>createLilyPads(new Position(55 + i*110, 0))(0)
                     ({id:String(i),createTime:Constants.StartTime})),
                     
  // initialise starting game state       
  initialState:State = {
    time:0,
    lilypads: createAllLilyPads,
    fly: createFly(new Position (275, 0))(0)({id:'', createTime:Constants.StartTime}),
    frog: createFrog({id:'', createTime:Constants.StartTime}),
    cars: createAllCars,
    logs: createAllLogs,
    turtles: createAllTurtles,
    gameOver: false,
    destination: [],
    restart: false,
    lives: 3,
    currentScore: 0,
    highScore:  0,
    gameSpeed: 1
  },
  
  // functions that are used to manage object movement and behaviour
  // wrap frogger objects around the canvas so that each object comes around from the other side
  torusWrap = ({x, y}:Position) => { 
    const s = Constants.CanvasSize, 
    wrap = (v:number) => v < -500 ? v + s + 500  : v > s + 400  ? v - s - 580 : v;
    return new Position (wrap(x), y)
  },

  // move frogger objects by updating their position based on the object's displacement and axis
  // also set frog displacement to 0 after each movement to prevent it from continue moving without user input
  moveFroggerObjects = (o:FroggerObjects)  => <FroggerObjects>  {
    ...o,
      pos: o.axis == "x" ? torusWrap(new Position(o.pos.x + o.displacement, o.pos.y)): new Position(o.pos.x, o.pos.y + o.displacement),
      displacement: o.viewType === "frog" ? 0 : o.displacement,    
  },

  // sync the displacement of frog with log or turtle depending on whether which one the frog is currently on
  // this allows frog to move along with log or turtle
  syncDisplacementAndAxis = (o:FroggerObjects, l:FroggerObjects) => <FroggerObjects> {
    ...o,
    displacement: l.displacement,
    axis: l.axis
  },

  // increase frogger object speed when all five lilypads are filled
  increaseSpeed = (s:State) => (o:FroggerObjects) => <FroggerObjects> {
    ...o,
    displacement: o.displacement * s.gameSpeed
  },

  // model turtle behaviour of sinking and rising
  // this function is only called every 30 ticks to sync with the sinking and rising animation of the turtle
  turtlesBehaviour = (o:FroggerObjects) => <FroggerObjects> {
    ...o,
    height: o.risingTurtles ? o.height + 7.857 : o.height - 6.1,
    width: o.risingTurtles  ? o.width + 7.857 : o.width - 6.1 ,
    risingTurtles: o.height < 10 && o.width < 10 ? true : o.height > 43 && o.width > 43 ? false : o.risingTurtles,
  },
  // end of functions for object movement and behaviour

  // functions that are used to manage object graphics
  // function to cycle to different cars in spritesheet
  setCarFrame = (o:FroggerObjects) => <FroggerObjects> {
    ...o,
    frameY: o.pos.x != 600 && o.pos.x != -200 ? o.frameY : o.frameY === 0 ? 1 : o.frameY === 1 ? 2 : o.frameY === 2 ? 0 : o.frameY  
  },  

  // used to prolong frames to achieve a more natural animation, i.e. make the frames of frog jumping visible longer so that jump animation is not merely a blink
  // this function is only called every 10 or 30 ticks depending on the frogger object
  delayFrames = (o:FroggerObjects) => <FroggerObjects> {
    ...o,
    frameX: o.viewType === 'frog' ? 0 : o.risingTurtlesFrame ? progressiveDecrease(o.frameX): progressiveIncrease(o.frameX),
    risingTurtlesFrame: o.frameX < 0.1 ? false : o.frameX > 7.5 ? true : o.risingTurtlesFrame
  },

  // used to animate the turtle sinking 
  // due to the irregularities in spritesheet used, i.e. each frame is not equal distance apart in the spritesheet
  // hence, numbers have to be hard coded to acheive desired effects
  progressiveIncrease = (n:number) => {
    return n === 0 ? 1 : n === 1 ? 2 : n === 2 ? 3 : n === 3 ? 4 : n === 4 ? 5 : n === 5 ? 6 : n === 6 ? 6.726 : n === 6.726 ? 7.4 : n === 7.4 ? 8 : n
  },

  // used to animate the turtle rising
  // due to the irregularities in spritesheet used, i.e. each frame is not equal distance apart in the spritesheet
  // hence, numbers have to be hard coded to acheive desired effects
  progressiveDecrease = (n:number) => {
    return  n === 8 ? 7.4 : n === 7.4 ? 6.726 : n === 6.726 ? 6 : n === 6 ? 5 : n === 5 ? 0 : n
  },
  // end of function for object graphics


  // check if collisions occur by checking whether the area of one rectangle is overlapped with the area of another rectangle
  collisions = ([a, b]:[FroggerObjects, FroggerObjects]) => 
               (a.pos.x < b.pos.x + b.width) &&
               (a.pos.x + a.width > b.pos.x) && 
               (a.pos.y < b.pos.y + b.height) &&  
               (a.pos.y + a.height > b.pos.y),

  // handle all states that require the checking of collision events and other miscellanous states 
  handleGameState = (s:State) => {
    const
      frogCapturedFly = collisions([s.frog, s.fly]),
      
      collisionForCars = s.cars.filter(r=>collisions([s.frog,r])),
      frogAndCarsCollided = collisionForCars.length > 0,

      collisionForLogs = s.logs.filter(r=>collisions([s.frog,r])),
      // return the log that collided with the frog, since there can only be one at a time, index 0 is used
      collidedLog = collisionForLogs[0],
      // check if any logs and frog collided
      frogAndLogsCollided = collisionForLogs.length > 0,

      collisionForTurtles = s.turtles.filter(r=>collisions([s.frog,r])),
      // return the turtle that collided with the frog, since there can only be one at a time, index 0 is used
      collidedTurtle = collisionForTurtles[0],
      // check if any turtles and frog collided
      frogAndTurtlesCollided = collisionForTurtles.length > 0,

      collisionForLilyPads = s.lilypads.filter(r=>collisions([s.frog, r])),
      nonCollisionForLilyPads = s.lilypads.filter(r=>!collisions([s.frog, r])),
      // return the lily pad that collided with the frog, since there can only be one at a time, index 0 is used
      collidedLilyPads = collisionForLilyPads[0],
      // check if any lily pads and frog collided
      frogAndLilyPadsCollided = collisionForLilyPads.length > 0 ,
      // returns a random lily pad that has not collided with a frog before
      randomLilyPads = nonCollisionForLilyPads[s.time%nonCollisionForLilyPads.length],
      // returns a random lily pad after a restart of the game
      randomLilyPadsStart = createAllLilyPads[s.time%createAllLilyPads.length],
  
      collisionsForFrog = s.destination.filter(r=>collisions([s.frog,r])),
      frogandFrogCollided = collisionsForFrog.length > 0,

      frogAndRiverCollided = (s.frog.pos.y < 242) ? (!frogAndLogsCollided && !frogAndTurtlesCollided && !frogAndLilyPadsCollided) :false,
      lastLilyPad = s.lilypads.length == 1,
      allLilyPadsFilled = s.lilypads.length < 1

    return <State>{
      ...s,
      time: s.restart ? 0 : s.time,

      lilypads: s.restart || allLilyPadsFilled ? createAllLilyPads 
                : frogAndLilyPadsCollided ? nonCollisionForLilyPads
                : s.lilypads,
      // fly spawns randomly when frog captured fly
      // when all lilypads are filled, create a new fly with the position of a random lily pad based on the starting lily pad orientation
      // when frog captures a fly, create a new fly with the position of a random lily pad based on the lily pads that have not collided with a frog
      fly: s.restart || allLilyPadsFilled ? createFly(new Position (randomLilyPadsStart.pos.x, randomLilyPadsStart.pos.y))(0)({id:String(s.time),createTime:s.time}) 
           : frogCapturedFly && !lastLilyPad ? createFly(new Position (randomLilyPads.pos.x, randomLilyPads.pos.y))(0)({id:String(s.time),createTime:s.time})
           : s.fly,

      // a new frog is created if the it collides with anything other than a log or turtle
      // otherwise it moves with the log or turtle
      frog: s.restart
            || frogAndRiverCollided
            || frogAndCarsCollided
            || frogAndLilyPadsCollided
            || frogandFrogCollided ? createFrog({id:String(s.time), createTime:s.time})
            : frogAndLogsCollided ? syncDisplacementAndAxis(s.frog, collidedLog)
            : frogAndTurtlesCollided ? syncDisplacementAndAxis(s.frog, collidedTurtle)
            : s.frog,

      cars: s.restart ? createAllCars 
            : allLilyPadsFilled ? s.cars.map(increaseSpeed(s)) 
            : s.cars,

      logs: s.restart ? createAllLogs 
            : allLilyPadsFilled ? s.logs.map(increaseSpeed(s)) 
            : s.logs,

      turtles: s.restart ? createAllTurtles 
               : allLilyPadsFilled ? s.turtles.map(increaseSpeed(s)) 
               : s.turtles,

      gameOver: s.restart ? false : s.lives < 1,

      // when frog collides with a lily pad, creates a new dummy frog with the position of the lily pad the frog collided with
      // this allows drawImage to draw a separate image based on the frogs in the destination array as they are distinct from the frog the player is using based on viewType
      destination: s.restart || allLilyPadsFilled ? [] 
                   : frogAndLilyPadsCollided && !frogandFrogCollided ? [...s.destination, createDummyFrog({height:45, width:45})("null")(new Position(collidedLilyPads.pos.x, collidedLilyPads.pos.y))(0)({id:String(s.time),createTime:s.time})] 
                   : s.destination,

      restart: s.lives === 3 ? false : s.restart,

      lives: s.restart ? 3 
             : frogAndCarsCollided || frogAndRiverCollided || frogandFrogCollided ? s.lives - 1 
             : s.lives,

      currentScore: s.restart || s.gameOver ? 0 
                    : frogCapturedFly ? s.currentScore + 2 
                    : frogAndLilyPadsCollided ? s.currentScore + 1
                    : s.currentScore,

      highScore: s.currentScore > s.highScore ? s.currentScore
                 : s.highScore,

      gameSpeed: s.restart ? 1
                 : allLilyPadsFilled ? s.gameSpeed + 0.1
                 : s.gameSpeed
    }
  },
 

  // interval tick: update movements and frames of each frogger objects
  tick = (s:State,elapsed:number) => {
    const frogAndBorderCollided = s.frog.axis == "x" ? (s.frog.pos.x + s.frog.displacement > 556 || s.frog.pos.x + s.frog.displacement < -6) 
                                                     : (s.frog.pos.y + s.frog.displacement > 600 || s.frog.pos.y + s.frog.displacement  < -30)                                          

    return handleGameState({
      ...s, 
      frog: s.time % 10 === 0 ? delayFrames(s.frog) 
            : !frogAndBorderCollided ? moveFroggerObjects(s.frog)
            : s.frog,
      logs: s.logs.map(moveFroggerObjects), 
      cars: s.cars.map(moveFroggerObjects).map(setCarFrame),
      turtles: s.time % 30 === 0 ? s.turtles.map(turtlesBehaviour).map(delayFrames): s.turtles.map(moveFroggerObjects),
      time: elapsed
    })
  }, 

  // hold changes to the game state used to modify the initial state in the scan operator
  reduceState = (s:State, e:Jump|Tick|Restart)=> 
    e instanceof Jump  ? {...s,
      frog: {...s.frog, displacement:Constants.JumpDistance*e.direction, axis: e.axis, frameX: 1, frameY:e.frame}
    } : 
    e instanceof Restart ? {...s,
      restart: e.restart
    } : tick(s,e.elapsed)

  // merging all observables into one stream and scanning changes
  // scan updates game state based on changes in reduceState
  // finally, the game state is passed to updateView to update the game visuals  
  const subscription =
    merge(gameClock,
      jumpLeft,jumpRight,
      jumpUp,jumpDown,restart)
    .pipe(
      scan(reduceState, initialState))
    .subscribe(updateView)

    function updateView(s:State){
      // multiple canvas is required separate frogger objects based on layers, i.e. frog layer should be on top of logs and turtles but below cars
      const canvas1 = <HTMLCanvasElement> document.getElementById('canvas1')!,
            ctx1 = canvas1.getContext('2d')!,
            canvas3 = <HTMLCanvasElement> document.getElementById('canvas3')!,
            ctx3 = canvas3.getContext('2d')!,
            canvas4 = <HTMLCanvasElement> document.getElementById('canvas4')!,
            ctx4 = canvas4.getContext('2d')!

      if(!s.gameOver){
      // spritesheets stored in variables
      const frogImage = new Image();
      frogImage.src = 'https://www.frankslaboratory.co.uk/downloads/Frogger/frog_spritesheet.png';
      
      const carsImage = new Image();
      carsImage.src = 'https://www.frankslaboratory.co.uk/downloads/Frogger/cars.png';

      const logsImage = new Image();
      logsImage.src = 'https://www.frankslaboratory.co.uk/downloads/Frogger/log.png';

      const turtlesImage = new Image();
      turtlesImage.src = 'https://www.clipartmax.com/png/full/150-1504290_frogger-arcade-graphic-frogger-game-png.png';

      const flyImage = new Image();
      flyImage.src = 'https://www.clipartmax.com/png/full/150-1504290_frogger-arcade-graphic-frogger-game-png.png';

      const collisionsImage = new Image();
      collisionsImage.src = 'https://www.frankslaboratory.co.uk/downloads/Frogger/collisions.png';
      // end of spritesheets
      const oneOrZero = (n:number) => {
        return n < 0 ? 1 : 0
      }

      function handleScore(){
        // updates text based information on game
        ctx4.fillStyle = "black"
        ctx4.strokeStyle = "black"
        ctx4.font = "15px Verdana"
        ctx4.strokeText("Lives: " + s.lives, 10, 135)
        ctx4.strokeText("Score: " + s.currentScore, 10, 155)
        ctx4.strokeText("High Score: " + s.highScore, 10, 175)
        ctx4.strokeText("Game Speed: " + s.gameSpeed, 10, 195)
      }

      // animate game based on position and frame changes
      // each canvas layer is cleared and redrawn to achieve and animated effect via ctx.clearRect
      // frogger object frameX and frameY helps determined which image is going to be used in the spritesheet for the animation 
      function animate(){
        ctx1.clearRect(0, 0, canvas1.width, canvas1.height)
        ctx3.clearRect(0, 0, canvas3.width, canvas3.height)
        ctx4.clearRect(0, 0, canvas4.width, canvas4.height)
        const drawFroggerObjects = (o:FroggerObjects) =>{
          if(o.viewType === "frog"){
            ctx3.drawImage(frogImage, o.frameX*250, o.frameY*250, 250, 250, o.pos.x - 27.5, o.pos.y - 27.5, 100, 100)
          }
          if(o.viewType === "fly"){
            ctx3.drawImage(flyImage, 75, 160, 60, 70, o.pos.x-10, o.pos.y, 60, 70)
          }
          else if(o.viewType === "cars"){
            ctx4.drawImage(carsImage, oneOrZero(o.displacement)*160, o.frameY*77, 160, 70, o.pos.x, o.pos.y-15, 180, 80)
          }
          else if(o.viewType === "logs"){
            ctx1.drawImage(logsImage, o.pos.x-10, o.pos.y-20, 220, 90)
          }
          else if(o.viewType === "turtles"){
            ctx1.drawImage(turtlesImage, o.frameX*73 + 11, 75, 70, 80, o.pos.x-17, o.pos.y-13, 100, 80)
          }
          else if(o.viewType === "dummyfrog"){
            ctx3.drawImage(frogImage, 0, 750, 250, 250, o.pos.x-27.5, o.pos.y-15, 100, 100)
          }  
        }
        drawFroggerObjects(s.frog)   
        drawFroggerObjects(s.fly)
        s.destination.forEach(drawFroggerObjects) 
        s.cars.forEach(drawFroggerObjects)
        s.logs.forEach(drawFroggerObjects)
        s.turtles.forEach(drawFroggerObjects)
        handleScore()
      }
     

      requestAnimationFrame(animate)
      }
      else{
        // draw Game Over and press R to restart if live equals zero
        ctx4.fillStyle = "red"
        ctx4.font = "60px Verdana"
        ctx4.fillText("Game Over", 130, 300)
        ctx4.fillStyle = "red"
        ctx4.font = "30px Verdana"
        ctx4.fillText("Press R to Restart", 170, 340)
      }
    }
}

// draw additional images from spritesheet
// it is a seperate function because these images only need to be drawn once
function additionalAssets(){
  const canvas2 = <HTMLCanvasElement> document.getElementById('canvas2')!,
        ctx2 = canvas2.getContext('2d')!
        
  const lilypadsImage = new Image();
  lilypadsImage.src = 'https://www.clipartmax.com/png/full/150-1504290_frogger-arcade-graphic-frogger-game-png.png'

  const bushImage = new Image();
  bushImage.src = 'https://www.clipartmax.com/png/full/150-1504290_frogger-arcade-graphic-frogger-game-png.png'

  lilypadsImage.onload = function(){
    ctx2.drawImage(lilypadsImage, 490, 150, 100, 100, 40, -10, 80, 80)
    ctx2.drawImage(lilypadsImage, 490, 150, 100, 100, 150, -10, 80, 80)
    ctx2.drawImage(lilypadsImage, 490, 150, 100, 100, 260, -10, 80, 80)
    ctx2.drawImage(lilypadsImage, 490, 150, 100, 100, 370, -10, 80, 80)
    ctx2.drawImage(lilypadsImage, 490, 150, 100, 100, 480, -10, 80, 80)
  }

  bushImage.onload = function(){
    ctx2.drawImage(bushImage, 400, 150, 95, 95, -10, -11.5, 62, 77.5)
    ctx2.drawImage(bushImage, 400, 150, 95, 95, 100, -11.5, 62, 77.5)
    ctx2.drawImage(bushImage, 400, 150, 95, 95, 210, -11.5, 62, 77.5)
    ctx2.drawImage(bushImage, 400, 150, 95, 95, 320, -11.5, 62, 77.5)
    ctx2.drawImage(bushImage, 400, 150, 95, 95, 430, -11.5, 62, 77.5)
    ctx2.drawImage(bushImage, 400, 150, 95, 95, 545, -11.5, 62, 77.5)
  }   
}

// function showKeys() {
//   function showKey(k:Key) {
//     const arrowKey = document.getElementById(k)!,
//       o = (e:Event) => fromEvent<KeyboardEvent>(document,e).pipe(
//         filter(({code})=>code === k))
//     o('keydown').subscribe(e => arrowKey.classList.add("highlight"))
//     o('keyup').subscribe(_=>arrowKey.classList.remove("highlight"))
//   }
//   showKey('ArrowLeft');
//   showKey('ArrowRight');
//   showKey('ArrowUp');
//   showKey('ArrowDown');
// }


// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
    additionalAssets();
    // showKeys();
    
  };
}




 