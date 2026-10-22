var canvas, ctx;

// Number of frets on the canvas frettboard.
var numberOfFrets = 15;

// Objects inserted into buffer (mostly notes by clicking on frettboard). Used by undo and redo buttons.
var insertedObjects = [];
var redoObjects = [];

// True if we are inside chord.
var insideChord = false;

// insertPosition is position in text editor where insertedObjects are inserted (important if we click in the middle of text area):
var insertPosition = 0;

// insertedTextLength is length of a text for all insertedObjects (little tricky !!!! todo explanation)
var insertedTextLength = 0;

// page elements:
var fretsSelection, sharpOrFlatSelector, dotSelector;
var chordButton, tripletButton, arpeggioButton, arpeggioLabel;
var editor, textInClipboard;
var chkGrace, chkFermata;
var barreSelector, rightHandSelector, ornamentSelector, articulationSelector;
var insertionSelector;
var newBarSelector;

// initialize page elements:
function initElements() {
    fretsSelection = document.getElementById("number_of_frets");
    fretsSelection.value = numberOfFrets;
    sharpOrFlatSelector = document.getElementById("sharp_or_flat");
    chordButton = document.getElementById("chb_chord");
    chordButton.checked = false;
    insideChord = false;
    tripletButton = document.getElementById("chb_triplet");
    tripletButton.checked = false;
    arpeggioButton = document.getElementById("chb_arpeggio");
    arpeggioLabel = document.getElementById("lbl_arpeggio");
    arpeggioButton.style.visibility = "hidden";
    arpeggioLabel.style.visibility = "hidden";
    editor = document.getElementById("editor");
    editor.value = "";
    dotSelector = document.getElementById("dot");
    chkGrace = document.getElementById("chb_grace");
    chkFermata = document.getElementById("chb_fermata");
    barreSelector = document.getElementById("barre");
    rightHandSelector = document.getElementById("r_h_finger");
    ornamentSelector = document.getElementById("ornament");
    articulationSelector = document.getElementById("articulation");
    insertionSelector = document.getElementById("insert");
    newBarSelector = document.getElementById("new_bar");
    setTitles();
}

// sets titles for some elements (for tooltip)
function setTitles() {
    document.getElementById("btn_change_last").title = "change duration and fingering of the last note in buffer";
    document.getElementById("opt_duration").title = "inserts only the length of the note (number), the note value is the same as the previous note";
    document.getElementById("opt_tie").title = "insert this between both tied notes (inserting only duration after tie is recommended)";
    document.getElementById("opt_slur_start").title = "legato start, insert this after the first note";
    document.getElementById("opt_slur_end").title = "legato end, insert this after the last note";
    document.getElementById("opt_glissando").title = "insert this between both notes which are connected by glissando";
    document.getElementById("opt_lily").title = "insert basic lilypond bolerplate code (empty lilypond page)";
    document.getElementById("opt_zigzag").title = "set glissando style temporary to zigzag (insert this before both notes which are connected by glissando)";
    document.getElementById("lbl_chord").title = "switch on before first cord note, switch off after last cord note";
    document.getElementById("chb_chord").title = "switch on before first cord note, switch off after last cord note";
    document.getElementById("lbl_triplet").title = "switch on before first triplet note, switch off after last triplet note";
    document.getElementById("chb_triplet").title = "switch on before first triplet note, switch off after last triplet note";
}

window.onload = function () {
    window.addEventListener("resize", resizeCanvas, false);
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");
    initElements();
    resizeCanvas();
    onInsertingNewElement();
    canvas.addEventListener("mouseup", function (e) {
        canvasOnMouseUp(e);
    });
    editor.addEventListener("mousedown", function (e) {
        editorOnMouseDown();
    });
};

function canvasOnMouseUp(e) {
    let p1 = getPoint(e);
    if (p1.invalid) {
        return;
    }
    // if inside chord, check if string number allready inside chord:
    if (insideChord) {
        for (let i = insertedObjects.length - 1; i >= 0; i--) {
            let o1 = insertedObjects[i];
            if (o1.chordStart) {
                break;
            }
            if (o1.drawable) {
                if (o1.string === p1.string) {
                    alert("string " + p1.string + " allready in chord!");
                    return;
                }
            }
        }
    }
    insertedObjects.push(p1);
    resizeCanvas();
    editInsertedObjects();
    onInsertingNewElement();
}

function editorOnMouseDown() {
    if (chordButton.checked) {
        alert("Inside chord! Close chord first!");
        setTimeout(function () { chordButton.focus(); }, 1);
        return;
    }
    if (tripletButton.checked) {
        alert("Inside triplet! Close triplet first!");
        setTimeout(function () { tripletButton.focus(); }, 1);
        return;
    }
    insertedObjects = [];
    redoObjects = [];
    onInsertingNewElement();
    resizeCanvas();
    setTimeout(function () {
        insertPosition = editor.selectionStart;
        insertedTextLength = 0;
    }, 1);
}

function resizeCanvas() {
    // padding of frettboard div is 10, so:
    canvas.width = window.innerWidth - 20;
    canvas.height = canvas.width / 6;
    fretDistance = canvas.width / (numberOfFrets + 2);
    // drawing must be in this function, so that window is resized, canvas is restored
    drawEmptyFretBoard();
    drawInsertedObjects();
}

function drawInsertedObjects() {
    let drawingIndex = 0;
    let localInsideChord = insideChord;
    let pointDrawn = false;
    for (let i = insertedObjects.length - 1; i >= 0; i--) {
        let o1 = insertedObjects[i];
        if (!o1.drawable) {
            if (o1.chordEnd) {
                localInsideChord = true;
            } else if (o1.chordStart) {
                localInsideChord = false;
                if (pointDrawn) {
                    drawingIndex++;
                }
            }
        } else {
            o1.draw(drawingIndex);
            pointDrawn = true;
            if (!localInsideChord) {
                drawingIndex++;
            }
        }
        if (drawingIndex > 2) {
            break;
        }
    }
}

// writes insertedObjects[] into editor
// unredo is true if function was called from undo() or redo() or changeLastNote()
function editInsertedObjects(unredo = false) {
    let newText = "";
    for (let i = 0; i < insertedObjects.length; i++) {
        newText += insertedObjects[i].toString() + " ";
    }
    let pos = editor.selectionEnd;
    let oldText = editor.value;
    if ((insertedObjects.length == 1) && !unredo) {
        // This part is executed only for first note clicked on frettboard.
        // Can not undestand my old code now, what is exactly going on with respect to unredo flag, maybe refactor or comment better.
        insertPosition = pos;
        insertedTextLength = 0;
        // ensure single space before and after inserted elements:
        if (insertPosition > 0) {
            if (oldText[insertPosition - 1] !== " " && oldText[insertPosition - 1] !== "\n") {
                oldText = oldText.substring(0, pos) + " " + oldText.substring(pos);
                insertPosition += 1;
                pos += 1;
            }
        }
        if (newText.length > 0 && oldText.substring(pos, pos + 1) === " ") {
            oldText = oldText.substring(0, pos) + oldText.substring(pos + 1);
        }
        // 
    } else {
        pos = insertPosition;
    }
    editor.value = oldText.substring(0, pos) + newText + oldText.substring(pos + insertedTextLength);
    insertedTextLength = newText.length;
    textInClipboard = false;
}

function drawEmptyFretBoard() {
    markFrets();
    drawFrets();
    drawStrings();
    drawStringNames();
}

function markFrets() {
    // number of frets to be marked
    let numbers = [5, 7, 12, 17, 19, 24];
    ctx.fillStyle = "rgb(230, 230, 230)";
    for (let i = 0; i < numbers.length; i++) {
        let number = numbers[i];
        if (number > numberOfFrets) {
            break;
        }
        let x0 = canvas.width / (numberOfFrets + 2) * number;
        let x1 = canvas.width / (numberOfFrets + 2) * (1 + number);
        let y0 = canvas.height / 7;
        let y1 = canvas.height / 7 * 6;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x0, y1);
        ctx.fill();
        ctx.closePath();
    }
}

function drawFrets() {
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    // ctx.strokeStyle = "rgb(210, 170, 50)";
    ctx.strokeStyle = "rgb(105, 85, 25)";
    for (let fret = 0; fret <= numberOfFrets; fret++) {
        let y0 = canvas.height / 7;
        let y1 = canvas.height / 7 * 6;
        let x = canvas.width / (numberOfFrets + 2) * (1 + fret);
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
        ctx.stroke();
        ctx.closePath();
    }
}

function drawStrings() {
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgb(210, 170, 50)";
    for (let string = 1; string <= 6; string++) {
        if (string <= 3) {
            ctx.strokeStyle = "rgb(130, 140, 150)";
        } else {
            // ctx.strokeStyle = "rgb(105, 85, 25)";
            ctx.strokeStyle = "rgb(210, 170, 50)";
        }
        ctx.lineWidth = 2 + string / 2;
        let y = canvas.height / 7 * string;
        let x0 = canvas.width / (numberOfFrets + 2);
        let x1 = canvas.width / (numberOfFrets + 2) * (numberOfFrets + 1);
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.stroke();
        ctx.closePath();
    }
}

// draws string names and frett numbers
function drawStringNames() {
    let fontSize = canvas.height / 14;
    let stringNameX = canvas.width / (numberOfFrets + 2) / 3.5;
    let stringNameY = canvas.height / 7 + fontSize / 2.6;
    let stringNames = ["E", "B", "G", "D", "A", "E"];
    ctx.fillStyle = "rgb(140, 140, 140)";
    ctx.font = `${fontSize}px sans serif`;
    for (let i = 0; i < stringNames.length; i++) {
        ctx.fillText(stringNames[i], stringNameX, stringNameY + (canvas.height / 7 * i));
    }
    let fretNumbers = [5, 7, 12];
    let fretNumberY = canvas.height - fontSize / 2.5;
    let fretNumberX = canvas.width / (numberOfFrets + 2) / 2.5;
    for (let i = 0; i < fretNumbers.length; i++) {
        ctx.fillText(`${fretNumbers[i]}`, fretNumberX + canvas.width / (numberOfFrets + 2) * fretNumbers[i], fretNumberY);
    }
}

function uncheckAllLeftFingers() {
    let a1 = document.querySelector('input[name="lfinger"]:checked');
    if (a1 != null) {
        a1.checked = false;
    }
}

function uncheckAllDurations() {
    let a1 = document.querySelector('input[name="duration"]:checked');
    if (a1 != null) {
        a1.checked = false;
    }
    dotSelector.value = "none";
}

function clearAll() {
    if (chordButton.checked) {
        alert("Inside chord! Close chord first!");
        return;
    }
    if (tripletButton.checked) {
        alert("Inside triplet! Close triplet first!");
        return;
    }
    if (!textInClipboard && editor.value.length > 0) {
        let ans = confirm("Text was not copied to clipboard, do you realy want to clear it?");
        if (!ans) {
            return;
        }
    }
    insertedObjects = [];
    resizeCanvas();
    editor.value = "";
    onInsertingNewElement();
}

function toClipboard() {
    if (chordButton.checked) {
        alert("Inside chord! Close chord first!");
        return;
    }
    if (tripletButton.checked) {
        alert("Inside triplet! Close triplet first!");
        return;
    }
    textInClipboard = true;
    let textToCopy = editor.value;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(textToCopy);
    } else {
        // depreciated, but navigator does not work
        editor.select();
        document.execCommand('copy');
        editor.blur();
    }
}

function changeFrets() {
    numberOfFrets = Number(fretsSelection.value);
    resizeCanvas();
}

function chordOnOff() {
    if (chordButton.checked) {
        insideChord = true;
        arpeggioButton.style.visibility = "visible";
        arpeggioLabel.style.visibility = "visible";
        let startChord = new LilyElement("<");
        startChord.chordStart = true;
        insertedObjects.push(startChord);
        editInsertedObjects();
        redoObjects = [];
    } else {
        // check for empty chord:
        let previous = insertedObjects[insertedObjects.length - 1];
        if (previous.text === "<") {
            undo();
            return;
        }
        let elText = ">";
        // todo
        let durationSelector = document.querySelector('input[name="duration"]:checked')
        if (durationSelector) {
            elText += durationSelector.value;
            if (dotSelector.value != "none") {
                elText += dotSelector.value;
            }
        }
        if (arpeggioButton.checked) {
            elText += "\\arpeggio";
        }
        if (barreSelector.value != "none") {
            elText += "^\"" + barreSelector.value + "\"";
        }
        insideChord = false;
        arpeggioButton.style.visibility = "hidden";
        arpeggioLabel.style.visibility = "hidden";
        arpeggioButton.checked = false;
        let endChord = new LilyElement(elText);
        endChord.chordEnd = true;
        insertedObjects.push(endChord);
        editInsertedObjects();
        onInsertingNewElement();
    }
}

function tripletOnOff() {
    if (tripletButton.checked) {
        // check if chord not closed:
        if (chordButton.checked) {
            alert("Inside chord! Close chord first!");
            tripletButton.checked = false;
            return;
        }
        let startTriplet = new LilyElement("\\tuplet 3/2 {");
        startTriplet.tripletStart = true;
        insertedObjects.push(startTriplet);
        editInsertedObjects();
        redoObjects = [];
    } else {
        // check if chord not closed:
        if (chordButton.checked) {
            alert("Inside chord! Close chord first!");
            tripletButton.checked = true;
            return;
        }
        // check for empty triplet:
        let previous = insertedObjects[insertedObjects.length - 1];
        if (previous.text === "\\tuplet 3/2 {") {
            undo();
            return;
        }
        let endTriplet = new LilyElement("}");
        endTriplet.tripletEnd = true;
        insertedObjects.push(endTriplet);
        editInsertedObjects();
        onInsertingNewElement();
    }

}

function undo() {
    lastObject = insertedObjects.pop();
    if (insertedObjects.length === 0 || lastObject === undefined) {
        setTimeout(function () {
            editor.focus();
            editor.selectionStart = insertPosition;
            editor.selectionEnd = insertPosition;
        }, 1);
    }
    if (lastObject === undefined) {
        return;
    }
    redoObjects.push(lastObject);
    if (lastObject.chordEnd) {
        insideChord = true;
        chordButton.checked = true;
        arpeggioButton.style.visibility = "visible";
        arpeggioLabel.style.visibility = "visible";
        arpeggioButton.checked = false;
    } else if (lastObject.chordStart) {
        insideChord = false;
        chordButton.checked = false;
        arpeggioButton.style.visibility = "hidden";
        arpeggioLabel.style.visibility = "hidden";
        arpeggioButton.checked = false;
    } else if (lastObject.tripletEnd) {
        tripletButton.checked = true;
    } else if (lastObject.tripletStart) {
        tripletButton.checked = false;
    }
    editInsertedObjects(unredo = true);
    resizeCanvas();
}

function redo() {
    lastObject = redoObjects.pop();
    if (lastObject === undefined) {
        return;
    }
    insertedObjects.push(lastObject);
    if (lastObject.chordEnd) {
        insideChord = false;
        chordButton.checked = false;
        arpeggioButton.style.visibility = "hidden";
        arpeggioLabel.style.visibility = "hidden";
        arpeggioButton.checked = false;
    } else if (lastObject.chordStart) {
        insideChord = true;
        chordButton.checked = true;
        arpeggioButton.style.visibility = "visible";
        arpeggioLabel.style.visibility = "visible";
        arpeggioButton.checked = false;
    } else if (lastObject.tripletEnd) {
        tripletButton.checked = false;
    } else if (lastObject.tripletStart) {
        tripletButton.checked = true;
    }
    editInsertedObjects(unredo = true);
    resizeCanvas();
}

function insertNewBarOneVoice() {
    if (chordButton.checked) {
        alert("Inside chord! Close chord first!");
        return;
    }
    if (tripletButton.checked) {
        alert("Inside triplet! Close triplet first!");
        return;
    }
    if (editor.value.length === (insertPosition + insertedTextLength)) {
        let text = "|\n% bar \n";
        if (editor.value.length === 0) {
            text = "% bar \n";
        }
        insertedObjects.push(new LilyElement(text));
        editInsertedObjects();
        onInsertingNewElement();
    } else {
        text = "% bar \n ";
        let oldText = editor.value.trimEnd();
        if (oldText.length !== 0) {
            if (oldText[oldText.length - 1] !== "|") {
                oldText += " |";
            }
            oldText += "\n";
        }
        fullText = oldText + text;
        editor.value = fullText;
        let cursorIndex = fullText.length;
        editorOnMouseDown();
        editor.focus();
        editor.selectionStart = cursorIndex;
        editor.selectionEnd = cursorIndex;
        insertPosition = cursorIndex;
        insertedTextLength = 0;
    }
}

function insertNewBarTwoVoices() {
    if (chordButton.checked) {
        alert("Inside chord! Close chord first!");
        return;
    }
    if (tripletButton.checked) {
        alert("Inside triplet! Close triplet first!");
        return;
    }
    let text = `% bar 
<< { } \\\\
   { } >> |
`;
    let oldText = editor.value.trimEnd();
    if (oldText.length !== 0) {
        if (oldText[oldText.length - 1] !== "|") {
            oldText += " |";
        }
        oldText += "\n";
    }
    let cursorIndex = oldText.length + 22;
    editor.value = oldText + text;
    editorOnMouseDown();
    editor.focus();
    editor.selectionStart = cursorIndex;
    editor.selectionEnd = cursorIndex;
    insertPosition = cursorIndex;
    insertedTextLength = 0;
}



function insertNewBar() {
    let text = newBarSelector.value;
    if (text === "none") {
        return;
    } else if (text === "1") {
        insertNewBarOneVoice();
        newBarSelector.value = "none";
        return;
    } else if (text === "2") {
        insertNewBarTwoVoices();
        newBarSelector.value = "none";
    }
}

let lily_bolerplate = String.raw`
\version "2.20.0"
#(set-global-staff-size 21)
\header {
  title = \markup { \fontsize #-2 "Suite No. 1234 in D minor, Prelude"}
  composer = \markup { \fontsize #-2 "J.S. Bach, 1685 - 1750"}
  opus = \markup { \fontsize #-3 "BWV 9134"}
  piece = \markup { \fontsize #-3  "guitar transcription by Xxxx Yyyy"}
  tagline = \markup { \left-align \fontsize #-4 \italic  "Lilypond Score Edited by Xxxx Yyyy" }
  copyright = \markup { \right-align \fontsize #-4 \italic  "Creative Commons CC BY-SA 4.0" }
}
\pointAndClickOff

symbols = {
     \key d \minor
     \time 4/4
     \set fingeringOrientations = #'(left)
     \set stringNumberOrientations = #'(right)
     % bar 1:
     % your score goes here
     % bar 2:
     
}

% for score with tabulature:
\score {
  <<
    \new Staff \with { \omit StringNumber }  { \clef "treble_8" \symbols }
    \new TabStaff { \symbols }
  >>
}

% for score without tabulature:
% \score {
%   <<
%     \new Staff { \clef "treble_8" \symbols }
%   >>
% }
`;

function insertElement() {
    let text = insertionSelector.value;
    if (text === "none") {
        return;
    } else if (text === "r") {
        let selectedDuration = document.querySelector('input[name="duration"]:checked');
        if (selectedDuration) {
            text += selectedDuration.value;
            let dotValue = dotSelector.value;
            if (dotValue != "none") {
                text += dotValue;
            }
        }
    } else if (text === "s") {
        // get duration:
        let selectedDuration = document.querySelector('input[name="duration"]:checked');
        if (selectedDuration) {
            text += selectedDuration.value;
            // if dotted note:
            if (dotSelector.value != "none") {
                text += dotSelector.value;
            }
        }
    } else if (text === "d") {
        let selectedDuration = document.querySelector('input[name="duration"]:checked');
        if (selectedDuration) {
            text = selectedDuration.value;
            if (dotSelector.value != "none") {
                text += dotSelector.value;
            }
        } else {
            alert("There is no note duration selected!");
            insertionSelector.value = "none";
            return
        }
    } else if (text === "zigzag") {
        text = "\n\\once \\override Glissando.style = #'zigzag\n"
    } else if (text === "lily") {
        text = lily_bolerplate;
    }
    insertedObjects.push(new LilyElement(text));
    editInsertedObjects();
    onInsertingNewElement();
    insertionSelector.value = "none";
}

function onInsertingNewElement() {
    redoObjects = [];
    uncheckEverything();
}

function uncheckEverything() {
    chkGrace.checked = false;
    chkFermata.checked = false;
    uncheckAllLeftFingers();
    if (!insideChord) {
        uncheckAllDurations();
        barreSelector.value = "none";
    }
    rightHandSelector.value = "none";
    ornamentSelector.value = "none";
    articulationSelector.value = "none";
    insertionSelector.value = "none";
    newBarSelector.value = "none";
}

// music:


class Point {
    constructor(fret_number, string_number) {
        this.fret = fret_number;
        this.string = string_number;
        this.drawable = true;
        //
        this.flat = false;
        if (sharpOrFlatSelector.value === "flat") {
            this.flat = true;
        }
        this.text = getNoteName(this);
        // duration:
        if (!insideChord) {
            let selectedDuration = document.querySelector('input[name="duration"]:checked');
            if (selectedDuration) {
                this.text += selectedDuration.value;
                if (dotSelector.value != "none") {
                    this.text += dotSelector.value;
                }
            }
            if (chkGrace.checked) {
                this.text = "\\acciaccatura " + this.text;
            }
        }
        this.text += "\\" + string_number;
        let leftFinger = document.querySelector('input[name="lfinger"]:checked');
        if (leftFinger != null) {
            if (leftFinger.value === "0" && fret_number != 0) {
                alert("left finger is 0, and fret number is not 0 but " + fret_number);
                this.invalid = true;
                return;
            }
            if (leftFinger.value != 0 && fret_number === 0) {
                alert("fret number is 0, and left finger is not 0 but " + leftFinger.value);
                this.invalid = true;
                return;
            }
            this.text += "-" + leftFinger.value;
        }
        if (!insideChord) {
            if (chkFermata.checked) {
                this.text += "\\fermata";
            }
            if (ornamentSelector.value != "none") {
                this.text += "\\" + ornamentSelector.value;
            }
            if (articulationSelector.value != "none") {
                this.text += "\\" + articulationSelector.value;
            }
            if (barreSelector.value != "none") {
                this.text += "^\"" + barreSelector.value + "\"";
            }
        }
        if (rightHandSelector.value != "none") {
            this.text += "\\rightHandFinger #" + rightHandSelector.value;
        }
    }

    draw(index) {
        // point color:
        if (index === 0) {
            ctx.fillStyle = "rgb(0, 0, 0)"; // black
        } else if (index === 1) {
            ctx.fillStyle = "rgb(227, 83, 54)"; // terracotta (orange brown)
        } else if (index === 2) {
            ctx.fillStyle = "rgb(172, 225, 175)"; // celadon (greyish green)
        } else {
            ctx.fillStyle = "rgb(250, 199, 242)"; // dusty pink
        }
        // calculate radius:
        let radius = fretDistance / 7;
        let radius2 = canvas.height / 7 / 2;
        if (radius2 < radius) {
            radius = radius2;
        }
        let position = { x: 0, y: 0 };
        position.x = fretDistance * (this.fret + 1) - radius - (radius * 2 * index);
        position.y = canvas.height / 7 * this.string;
        ctx.beginPath();
        ctx.arc(position.x, position.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.closePath();
    }

    toString() {
        return this.text;
    }
}

class LilyElement {
    constructor(str) {
        this.text = str;
        this.drawable = false;
        this.chordStart = false;
        this.chordEnd = false;
        this.tupleStart = false;
        this.tupleEnd = false;
    }

    toString() {
        return this.text;
    }

}

// returns new Point(fret_number, string_number) for event e
function getPoint(e) {
    let bb = canvas.getBoundingClientRect();
    let pp = { x: 0, y: 0 }
    pp.x = e.clientX - bb.left;
    pp.y = e.clientY - bb.top;
    let fret_number = Math.floor(pp.x / canvas.width * (numberOfFrets + 2));
    let string_number = Math.round(pp.y / canvas.height * 7);
    if (string_number < 1) {
        string_number = 1;
    }
    if (string_number > 6) {
        string_number = 6;
    }
    p = new Point(fret_number, string_number);
    return p;
}


// Point p
function getNoteName(p) {
    let sn = p.string;
    let fn = p.fret;
    let name = "e,";
    switch (sn) {
        case 5:
            name = "a,";
            break;
        case 4:
            name = "d";
            break;
        case 3:
            name = "g";
            break;
        case 2:
            name = "b";
            break;
        case 1:
            name = "e'";
            break;
    }
    // if point p has attribute flat:
    name = stepUp(name, fn, p.flat);
    return name;
}


// name = note name, halftones = number of tones to step up, flat = flat if using b rather then #
function stepUp(name, halftones, flat) {
    let names = ["c", "cis", "d", "dis", "e", "f", "fis", "g", "gis", "a", "ais", "b"];
    let names_flat = ["c", "des", "d", "es", "e", "f", "ges", "g", "aes", "a", "bes", "b"];
    let nr_down = 0;
    let nr_up = 0;
    let name_pure = name;
    for (let i = 0; i < 4; i++) {
        if (name_pure.endsWith(",")) {
            name_pure = name_pure.slice(0, -1);
            nr_down++;
        } else {
            break;
        }
    }
    for (let i = 0; i < 4; i++) {
        if (name_pure.endsWith("'")) {
            name_pure = name_pure.slice(0, -1);
            nr_up++;
        } else {
            break;
        }
    }
    let index = -1;
    for (let i = 0; i < names.length; i++) {
        if (name_pure === names[i]) {
            index = i;
            break;
        }
        if (name_pure === names_flat[i]) {
            index = i;
            break;
        }
    }
    if (index === -1) {
        alert("index = -1 in stepUp, name = " + name + " , halftones = " + halftones + ", flat = " + "flat");
    }
    let new_index = index + halftones;
    let quotient = Math.floor(new_index / 12);
    let remainder = new_index % 12;
    if (nr_down === 0) {
        nr_up += quotient;
    } else if (nr_down <= quotient) {
        nr_down -= quotient;
    } else if (quotient > 0) {
        nr_up += (quotient - nr_down);
        nr_down = 0;
    }
    let new_name = names[remainder];
    if (flat) {
        new_name = names_flat[remainder];
    }
    for (let i = 0; i < nr_down; i++) {
        new_name += ",";
    }
    for (let i = 0; i < nr_up; i++) {
        new_name += "'";
    }
    return new_name;
}

// change duration and fingering of the last note in buffer:
function changeLastNote() {
    if (insertedObjects.length == 0) {
        alert("Buffer is empty, there is no note in it that can be changed!");
        uncheckEverything();
        return;
    }
    o1 = insertedObjects[insertedObjects.length - 1];
    if (!o1.drawable) {
        alert("last element in buffer is not a note!");
        uncheckEverything();
        return;
    }
    p1 = new Point(o1.fret, o1.string);
    insertedObjects.pop();
    insertedObjects.push(p1);
    resizeCanvas();
    editInsertedObjects(unredo = true);
    onInsertingNewElement();
    return;
}

function goToHelpPage() {
    window.open('help/lilymag_help.html', '_blank');
}


