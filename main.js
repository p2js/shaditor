//VARIABLES
let vertexShaderSource = ``;
let fragmentShaderSource = ``;
let time = 0;
let paused = false;
let fps = 60;
let gl;
let activeRenderer;

//CODE EDITOR
let editor = ace.edit("editor");
editor.setOptions({
  theme: "ace/theme/tomorrow_night_eighties",
  highlightActiveLine: false,
  enableLiveAutocompletion: document.getElementById("autocomplete").checked
});

var fragmentText = ace.createEditSession(`varying lowp vec4 vertexColor;
precision highp float;
uniform float time;
uniform vec2 resolution;

void main() {
    vec2 st = gl_FragCoord.xy/resolution.xy;
    st.x *= resolution.x/resolution.y;

    vec3 color = vec3(0.);
    color = vec3(st.xy,abs(sin(time / 90.)));

    gl_FragColor = vec4(color,1.0);
}`);
fragmentText.setMode("ace/mode/glsl");

var vertexText = ace.createEditSession(`attribute vec4 aVertexPosition;
attribute vec4 aVertexColor;
uniform float time;

varying lowp vec4 vertexColor;

void main() {
  gl_Position = aVertexPosition;
  vertexColor = aVertexColor;
}`);

vertexText.setMode("ace/mode/glsl");
editor.setSession(fragmentText);

//PAGE SETUP
const canvas = document.getElementById("glCanvas");
const frameDisplay = document.getElementById("time");
const fragmentButton = document.getElementById("fragmentButton");
const vertexButton = document.getElementById("vertexButton");
const settingsButton = document.getElementById("applySettings");
const canvasWidthInput = document.getElementById("canvasWidthArea");
const canvasHeightInput = document.getElementById("canvasHeightArea"); 
const editorFontSizeInput = document.getElementById("editorFontSize")
const pauseButton = document.getElementById("pauseShader");
const runButton = document.getElementById("runButton");
const resetButton = document.getElementById("resetButton");
const autoCompleteCheckbox = document.getElementById("autocomplete");
const pauseIcon = document.getElementById("pauseIcon");
const playIcon = document.getElementById("playIcon");
const expandArrow = document.getElementById("expandArrow");
const settingsDiv = document.getElementById("settingsDiv");
const saveButton = document.getElementById("saveButton");
const loadButton = document.getElementById("loadButton");
const shaderNameInput = document.getElementById("saveName");
const saveStatus = document.getElementById("statusParagraph");
const activeTabColor = "#2d2d2d";
const inactiveTabColor = "#454545";
const playingColor = "#3cb371";
const pausedColor = "#e2b714";
fragmentButton.style.backgroundColor = activeTabColor;
vertexButton.style.backgroundColor = inactiveTabColor;
let settingsExpanded = false;

playIcon.classList.toggle("invis");

const applySettings = () => {
  document.getElementById("editor").style.fontSize = editorFontSizeInput.value ? `${editorFontSizeInput.value}px` : "14px";
  canvas.style.width = canvasWidthInput.value ? `${canvasWidthInput.value}px` : "500px";
  canvas.style.height = canvasHeightInput.value ? `${canvasHeightInput.value}px` : "500px";
  canvas.width = canvasWidthInput.value ? canvasWidthInput.value : 500;
  canvas.height = canvasHeightInput.value ? canvasHeightInput.value : 500;
};
applySettings();

const togglePaused = () => {
  paused = !paused;
  if (activeRenderer) {
    if (paused) {
      frameDisplay.style.color = pausedColor;
    } else {
      frameDisplay.style.color = playingColor;
    };
  };
  playIcon.classList.toggle("invis");
  pauseIcon.classList.toggle("invis");
};

const resetTime = () => {
  time = 0;
  frameDisplay.value = time;
};

const load = () => {
  fragmentShaderSource = fragmentText.getValue();
  vertexShaderSource = vertexText.getValue();
  let timeValue = Number(frameDisplay.value);
  if (timeValue == 0 || timeValue) time = timeValue;
  if (!activeRenderer) {
    if(paused) togglePaused();
    runButton.textContent = "reload";
    frameDisplay.style.color = playingColor;
  } else {
    activeRenderer.cancel();
  }
  main();
}

fragmentButton.addEventListener("click", () => {
  editor.setSession(fragmentText);
  fragmentButton.style.backgroundColor = activeTabColor;
  vertexButton.style.backgroundColor = inactiveTabColor;
});

vertexButton.addEventListener("click", () => {
  editor.setSession(vertexText);
  fragmentButton.style.backgroundColor = inactiveTabColor;
  vertexButton.style.backgroundColor = activeTabColor;
});

let clickedTime = false;
frameDisplay.addEventListener("mouseenter", frameDisplay.focus);
frameDisplay.addEventListener("mouseleave", () => { if (!clickedTime) frameDisplay.blur(); });
frameDisplay.addEventListener("click", () => { clickedTime = true; });
frameDisplay.addEventListener("focusout", () => {
  clickedTime = false;
  if (!frameDisplay.value) frameDisplay.value = 0;
});

pauseButton.addEventListener("click", () => {
  if (paused) {
    let timeValue = Number(frameDisplay.value);
    if (timeValue == 0 || timeValue) time = timeValue;
  };
  togglePaused();
});

runButton.addEventListener("click", load);
resetButton.addEventListener("click", () => { resetTime(); if (activeRenderer) { activeRenderer.cancel(); main(); }; });
expandArrow.addEventListener("click", () => { 
  settingsExpanded = !settingsExpanded;
  expandArrow.classList.toggle("flipped");
  if (settingsExpanded) {
    settingsDiv.style.transform = "translateY(0px)";
    expandArrow.style.transform = "translateY(0px) rotate(-180deg)";
  } else {
    settingsDiv.style.transform = "translateY(-210px)";
    expandArrow.style.transform = "translateY(210px)";
  }
});
settingsButton.addEventListener("click", applySettings);
autoCompleteCheckbox.addEventListener("click", () => { editor.setOptions({ enableLiveAutocompletion: autoCompleteCheckbox.checked }); });

saveButton.addEventListener("click", () => {
  saveStatus.innerText = ""
  let name = shaderNameInput.value;
  if (!name || name == "lastActive") {
    error("Save Error: Invalid name");
    return;
  };
  let save = {
    frag: fragmentText.getValue(),
    vert: vertexText.getValue()
  };
  if(!save.frag || !save.vert) {
    error("Save Error: Empty shader file");
    return;
  }
  localStorage.setItem(name, JSON.stringify(save));
});

loadButton.addEventListener("click", () => {
  saveStatus.innerText = ""
  let name = shaderNameInput.value;
  if (!name || name == "lastActive") {
    error("Load Error: Invalid name");
    return;
  };
  let save = localStorage.getItem(name);
  if(!save) {
    error("Load Error: empty save slot");
    return;
  };
  save = JSON.parse(save);
  fragmentText.setValue(save.frag);
  vertexText.setValue(save.vert);
});

const error = (text) => {
  saveStatus.innerText = text;
  setTimeout(() => { saveStatus.innerText = "" }, 3000);
}

//CANVAS/SHADER CODE
function loadShader(gl, type, source) {
  const type_str = type == gl.VERTEX_SHADER ? "vertex" : type === gl.FRAGMENT_SHADER ? "fragment" : "";
  const shader = gl.createShader(type);

  gl.shaderSource(shader, source);

  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert('an error occured compiling the ' + type_str + ' shader: \n\n' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('unable to initialize the shader program:  ' +
      gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}

function initBuffers(gl) {
  const positionBuffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  const positions = [ //square
    1.0, 1.0, //top right
    -1.0, 1.0, //bottom right
    1.0, -1.0, //top left
    -1.0, -1.0 //bottom left
  ];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const colors = [
    1.0, 1.0, 1.0, 1.0,    // white
    1.0, 0.0, 0.0, 1.0,    // red
    0.0, 1.0, 0.0, 1.0,    // green
    0.0, 0.0, 1.0, 1.0,    // blue
  ];

  const colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

  return {
    position: positionBuffer,
    color: colorBuffer
  };

};

function drawScene(gl, programInfo, buffers, time) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0); //clear to black
  gl.clearDepth(1.0); //clear everything
  gl.enable(gl.DEPTH_TEST); //enable testing
  gl.depthFunc(gl.LEQUAL); //near things obscure far things ?
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); //clear canvas before drawing on it


  {
    const numComponents = 2;  //number of values per iteration
    const type = gl.FLOAT;    //the data in the buffer is 32 bit floats
    const normalize = false;  // dont normalise (vectors?)
    const stride = 0;
    const offset = 0; //byte offset

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
      programInfo.attribLocations.vertexPosition,
      numComponents,
      type,
      normalize,
      stride,
      offset
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
  }

  {
    const numComponents = 4;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    gl.vertexAttribPointer(
      programInfo.attribLocations.vertexColor,
      numComponents,
      type,
      normalize,
      stride,
      offset
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);
  };

  gl.useProgram(programInfo.program);

  var timeLoc = gl.getUniformLocation(programInfo.program, "time");
  gl.uniform1f(timeLoc, time);
  var resolutionLoc = gl.getUniformLocation(programInfo.program, "resolution");
  gl.uniform2f(resolutionLoc, canvas.width, canvas.height);

  {
    const offset = 0;
    const vertexCount = 4;
    gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
  }
};

async function main() {
  // Initialize the GL context
  gl = canvas.getContext("webgl2");
  // Only continue if WebGL is available and working
  if (!gl) {
    alert("Unable to initialize WebGL. Your browser or machine may not support it.");
    return;
  };

  const shaderProgram = initShaderProgram(gl, vertexShaderSource, fragmentShaderSource);

  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
      vertexColor: gl.getAttribLocation(shaderProgram, 'aVertexColor')
    },
  };

  const buffers = initBuffers(gl);
  drawScene(gl, programInfo, buffers, time);

  activeRenderer = accurateInterval(() => {
    if (!paused) {
      time++;
      frameDisplay.value = time;
      drawScene(gl, programInfo, buffers, time);
    };
  }, (1000 / fps));
};

const accurateInterval = (f, ms) => {
  let nextAt = new Date().getTime() + ms;
  let timeout = null;
  let wrappedFunction = () => {
    nextAt += ms;
    timeout = setTimeout(wrappedFunction, (nextAt) - (new Date().getTime()));
    return f();
  }
  let cancel = () => {
    return clearTimeout(timeout);
  }
  timeout = setTimeout(wrappedFunction, nextAt - new Date().getTime());
  return { cancel };
};

window.onload = () => {
  resetTime();
  if (localStorage.getItem("lastActive") < Date.now().toString() - 600000) {
    //it has been more than 10 minutes, show the start screen
    document.getElementById("startup").style.display = "inherit";
  };
  setInterval(() => { localStorage.setItem("lastActive", Date.now().toString()) }, 10000)
};