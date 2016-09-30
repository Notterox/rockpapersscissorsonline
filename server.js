var express = require('express');
var randomstring = require('randomstring');
var async = require('async');

var app = express();

var playerQueue = [];
var playerStates = [];
var games = [];
var gameWatchers = [];

app.use('/ng', express.static('node_modules/angular'))
app.use('/ng', express.static('node_modules/angular-route'))
app.use('/bs', express.static('node_modules/bootstrap/dist'))
app.use('/jq', express.static('node_modules/jquery/dist'))

app.use(express.static('public'));

app.get('/', function(req, res, err) {
	res.sendFile(__dirname + '/public/index.html');
});

app.listen(80, function() {
	console.log('Server is listening on port 80');
})

//Queue logic

app.get('/takeQueueToken', function(req, res, err){
	var token = randomstring.generate();
	
	playerQueue.push(token);
	playerStates[token] = {gameCreated: false, gameToken: undefined};

	console.log(token);
	res.send(token); 
});

app.get('/queue/:playerToken', function(req, res, err) {
	res.setHeader('Content-Type', 'application/json');
	res.send(JSON.stringify(playerStates[req.params.playerToken]));
});

// Handle wrong input 
app.use('/game/:gameToken/:playerToken', function(req, res, next){
	var playerToken = req.params.playerToken;
	var gameToken = req.params.gameToken;

	if (games[gameToken] == undefined || 
		games[gameToken].playerTokens.indexOf(playerToken) == -1)
	{
		res.setHeader('Content-Type', 'application/json');
		res.send(JSON.stringify({error: 'wrong parameters'}));
	}

	next();
});

app.use('/game/:gameToken/:playerToken/round/:roundId', function(req, res, next){
	var gameToken = req.params.gameToken;
	if (parseInt(req.params.roundId) > games[gameToken].currentRound)
		res.send(JSON.stringify(undefined));
	else
		next();
})

//Game Prototypes

var BeatMap = [[0, 1, -1], [-1, 0, 1], [1, -1, 0]]

function Round(roundNum) {

	var playersCount = 2;
	var moves = [];
	moves.length = playersCount;
	moves.fill(-1);
	this.moves = moves;
	this.winnerId = -1;

	this.finished = false;
	this.timeout = false;

	this.checkReadiness = function(){
		return !this.moves.some(function(move){return move == -1;})
	}
	
	this.processRound = function(){
		if (this.checkReadiness() == false)
			return -1;

		var res = BeatMap[this.moves[0]][this.moves[1]];
		console.log("FIGHT PROCESSING");
		console.log(this.moves);
		console.log("FIGHT RESULT: " + res);
		switch(res)
		{
			case 0: 
				this.winnerId = -1;
				break;
			case 1: 
				this.winnerId = 0 ;
				break;
			case -1: 
				this.winnerId = 1;
				break;
		}

		this.finished = true;
		return this.winnerId;
	}

	this.move = function(playerId, moveId)
	{
		this.moves[playerId] = moveId;
	}

	this.reset = function() {
		this.finished = false;
		this.winnerId = -1;
		this.timeout = false;

		this.moves.fill(-1);
	}

	this.watchRound = function(cb, duration) {
		if (duration == undefined)
			duration = 10000;
		
		setTimeout(function(){
			cb();
		}, duration)
	} 
}

function Game(playerTokens) {
	this.currentRound = 0;
	this.totalRounds = 5;
	this.playerTokens = playerTokens;

	var scores = [];
	scores.length = playerTokens.length;
	scores.fill(0);
	
	this.playerScores = scores;
	this.rounds = [];
	this.finished = false;
	this.winnerId = -1;

	this.getCurrentRound = function(){
		return this.rounds[this.currentRound];
	}

	this.getPlayerMoveInCurrentRound = function(playerToken){
		return this.getCurrentRound().moves[this.getPlayerIdByToken(playerToken)];
	}

	this.getPlayerMoveInRound = function(playerToken, roundNum) {
		if (roundNum > this.currentRound)
			return -1;
		return this.rounds[roundNum].moves[this.getPlayerIdByToken(playerToken)];
	}

	this.getPlayerIdByToken = function(playerToken){
		return this.playerTokens.indexOf(playerToken);
	}

	this.startGame = function() {
		console.log('Game Started');
		console.log(this.playerTokens);
		this.rounds.push(new Round(0));
	};

	this.playerMove = function(playerToken, moveId)
	{
		var playerId = this.playerTokens.indexOf(playerToken);
		this.getCurrentRound().move(playerId, moveId);
		return this.round();
	}

	this.round = function() {
		if (this.rounds[this.currentRound].checkReadiness() == true)
		{
			console.log('FIGHT!');
			var roundWinnerId = this.getCurrentRound().processRound()
			var round = this.getCurrentRound();
			console.log(round);
			if (roundWinnerId == -1)
			{
				console.log('DRAW! REPEATE ROUND');
				this.nextRound();
			}
			else
			{
				console.log('WINNER: PLAYER ' + roundWinnerId);
				this.playerScores[roundWinnerId]++;
				this.nextRound();
			}
			return {finished: true, round: round};
		}
		else return {finished: false};
	};

	this.nextRound = function() {
		if (this.playerScores.some(function(score){return score >= 5}))
			this.finishGame();
		else
		{
			var round = new Round(this.currentRound + 1)
			this.rounds.push(round);
			console.log('Next round!');
			console.log(round);
			this.currentRound++;
		}
	};

	this.repeateRound = function() {
		this.rounds[this.currentRound].reset();
	}

	this.finishGame = function() {
		this.finished = true;
		if (this.playerScores[0] > this.playerScores[1])
			this.winnerId = 0;
		else
			this.winnerId = 1;
	};

}

// Game Logic

app.get('/game/:gameToken/:playerToken/state', function(req, res, err){
	var playerToken = req.params.playerToken;
	var gameToken = req.params.gameToken;
	var game = games[gameToken];

	res.setHeader('Content-Type', 'application/json');
	res.send(JSON.stringify({
		playerId: game.playerTokens.indexOf(playerToken),
		currentRound: game.currentRound,
		playerScores: game.playerScores,
		moveInCurrentRound: game.getPlayerMoveInCurrentRound(playerToken),
		finished: game.finished,
		winnerId: game.winnerId
	}));
});

app.get('/game/:gameToken/:playerToken/round/:roundNum', function(req, res, err){
	var playerToken = req.params.playerToken;
	var gameToken = req.params.gameToken;
	var game = games[gameToken];
	var playerId = game.getPlayerIdByToken(playerToken);
	var round = game.rounds[req.params.roundNum];
	var roundNum = req.params.roundNum;

	res.setHeader('Content-Type', 'application/json');
	if (round.finished)
	{
		res.send(JSON.stringify({
			playerId: playerId,
			playerMoveId: game.getPlayerMoveInRound(playerToken, roundNum),
			finished: true, 
			round: round,
		}));
	}
	else
	{
		res.send(JSON.stringify({
			playerId: playerId, 
			playerMoveId: game.getPlayerMoveInRound(playerToken, roundNum),
			finished: false
		}));
	}
});

app.get('/game/:gameToken/:playerToken/makeMove/:moveId', function(req, res, err) {
	var playerToken = req.params.playerToken;
	var gameToken = req.params.gameToken;
	var game = games[gameToken];
	var round = game.rounds[req.params.roundNum];
	var moveId = req.params.moveId;

	var result = game.playerMove(playerToken, moveId);

	res.setHeader('Content-Type', 'application/json');
	res.send(JSON.stringify(result));
});

// Queue Managment

async.forever(function(next) {
	if (playerQueue.length >= 2) {
		var player1Token = playerQueue.shift();
		var player2Token = playerQueue.shift();

		createGame([player1Token,player2Token]);
	}

	setTimeout(next, 250);
});

function createGame(playerTokens) {
	var gameToken = randomstring.generate(16);

	//best of five by default
	games[gameToken] = new Game(playerTokens);
	var state = {gameCreated: true, gameToken: gameToken};
	for (var i = playerTokens.length - 1; i >= 0; i--) {
		playerStates[playerTokens[i]] = {gameCreated: true, gameToken: gameToken}
	}

	games[gameToken].startGame();
	games[gameToken].getPlayerMoveInCurrentRound(playerTokens[0]);
}