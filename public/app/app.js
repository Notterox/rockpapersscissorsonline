var app = angular.module('RPSOApp', ['ngRoute']);

app.config(function($routeProvider){
	console.log('configuring a provider')
	$routeProvider
	  .when("/", {
	    templateUrl : "views/main.htm"
	  })
	  .when('/searching', {
	  	templateUrl : "views/searching.htm"
	  })
	  .when('/game', {
	  	templateUrl : "views/game.htm"
	  })
	  .when('/win', {
	  	templateUrl : "views/win.htm"
	  })
	  .when('/lose', {
	  	templateUrl: "views/lose.htm"
	  });
});

app.service('gameTokenService', function(){
	var gameInfo = {};
	var setGameInfo = function(gameToken, playerToken){
		gameInfo.gameToken = gameToken;
		gameInfo.playerToken = playerToken;
	}
	var getGameInfo = function(){
		return gameInfo;
	}

	return {setGameInfo : setGameInfo, getGameInfo : getGameInfo};
})

app.run(function($rootScope){
	$rootScope.$on('$routeChangeStart', function(next, current){
	});
	$rootScope.$on('$routeChangeSuccess', function(next, current){

	});
	$rootScope.$on('$routeChangeError', function(next, current){

	});
});

app.controller('MainMenuCtrl', ['$scope', function($scope) {

}]);

app.controller('SearchGameCtrl', ['$scope', '$http', '$location', '$interval', '$timeout', 'gameTokenService',
	function($scope, $http, $location, $interval, $timeout, gameTokenService) {
	$scope.dots = '.';
	$scope.init = function() {
		$http.get('/takeQueueToken')
		.then(function(res){
			console.log(res.data);
			$scope.playerToken = res.data;
			$scope.checkTimer = $interval($scope.checkPlayerState, 1000);
		});
	}

	$scope.checkPlayerState = function() {
		$http.get('/queue/' + $scope.playerToken)
		.then(function(res){
			console.log(res);
			var state = res.data;
			
			$scope.animateDots();
			
			if (state.gameCreated == false)
				console.log('game is not created')
			else
			{
				console.log(state);
				$scope.gameToken = state.gameToken;
				gameTokenService.setGameInfo($scope.gameToken, $scope.playerToken);
				$location.url('/game/');
				$interval.cancel($scope.checkTimer);
			}
		});
	}
	
	$scope.animateDots = function() {
		if ($scope.dots.length >= 3)
			$scope.dots = '';
		else
			$scope.dots = $scope.dots + '.';
	}

	$scope.init();
}]);

app.controller('GameCtrl', ['$scope', '$http', 'gameTokenService', '$timeout', '$location',
	function($scope, $http, gameTokenService, $timeout, $location) {

	$scope.currentRound = 0;
	$scope.init = function () {
		$scope.gameToken = gameTokenService.getGameInfo().gameToken;
		$scope.playerToken = gameTokenService.getGameInfo().playerToken;
		$scope.updateGameState();

	}

	$scope.makeMove = function(move, $event) {

		$http.get('/game/' + $scope.gameToken + '/' + $scope.playerToken + '/makeMove/' + move)
		.then(function(res){
			$scope.updateRoundState();
		})

		$scope.hidePlayerMoveBtns();
	}

	$scope.getGameAPIUrl = function() {
		return "/game/" + $scope.gameToken + '/' + $scope.playerToken + '/';
	}

	$scope.updateRoundState = function() {
		$http
		.get($scope.getGameAPIUrl() + 'round/' + $scope.currentRound)
		.then(function(res){
			var data = res.data;

			$scope.updateMoveImg(data.playerMoveId, true);
			if (data.finished)
			{
				$scope.updateMoveImg(data.round.moves[1 - data.playerId], false);
				
				if (data.round.winnerId == -1)
					$timeout($scope.nextRound, 300);
				else if (data.playerId == data.round.winnerId)
					$scope.animatePlayerAttack($scope.nextRound);
				else
					$scope.animateOpponentAttack($scope.nextRound);
			}
			else 
			{
				$timeout(function(){
					$scope.updateRoundState();
				}, 500);
			}
		});
	}

	$scope.updateGameState = function(cb) {
		$http
		.get($scope.getGameAPIUrl() + 'state')
		.then(function(res){
			var data = res.data;
			console.log(data);
			if (data.finished == true){
				if (data.playerId == data.winnerId)
					$timeout(function(){$location.url('/win');}, 300);
				else
					$timeout(function(){$location.url('/lose');}, 300);
				return;
			}
			$scope.currentRound = data.currentRound;
			$scope.playerScore = data.playerScores[data.playerId];
			$scope.opponentScore = data.playerScores[1 - data.playerId];
			if (cb != undefined)
				cb();
		});
	}

	$scope.nextRound = function() {
		$scope.updateGameState(function(){
			$scope.resetMoveImg();
			$scope.showPlayerMoveBtns();
			$scope.resetMoveImg();
		})
	}

	$scope.updateMoveImg = function(moveId, isPlayer) {
		if (isPlayer == undefined)
			isPlayer = true;

		if (typeof moveId == 'string')
			moveId = parseInt(moveId);

		var target = {};
		if (isPlayer)
			target = $('#playerMoveImg');
		else
			target = $('#opponentMoveImg');

		switch(moveId)
		{
			case 0:
				$scope.animateImgChange(target, '/res/rock.svg');
				break;
			case 1:
				$scope.animateImgChange(target, '/res/scissors.svg');
				break;
			case 2:
				$scope.animateImgChange(target, '/res/paper.svg');
				break;
			case -1:
				$scope.animateImgChange(target, '/res/empty.svg');
				break;
			default:
				console.log("Unknow move id " + moveId);
		}
	}

	$scope.resetMoveImg = function() {
		var target = $('#playerMoveImg');
		target.attr('src', 'res/empty.svg');
		$('#opponentMoveImg').attr('src', 'res/empty.svg');
	}

	$scope.animateImgChange = function(target, src)
	{
		target.attr('src', src);
	}

	$scope.hidePlayerMoveBtns = function() {
		return $('.move-btns')
			.css({position: 'relative', left: '0px'})
			.animate({opacity: 0.0, left: '-40px'}, 100, 'swing', function(){$(this).css({visibility: 'hidden'})});
	}

	$scope.showPlayerMoveBtns = function() {
		return $('.move-btns')
			.css({position: 'relative', left: '-40px', visibility: 'visible'})
			.animate({opacity: 1.0, left: '0px'}, 100);
	}

	$scope.animatePlayerAttack = function(cb) {
		$('#playerMoveImg').css({position: 'relative'})
		.animate({left: '+=8em'}, 100).delay(100)
		.animate({left: '-=8em'}, 100).delay(100)
		.queue(function(next){
			cb();
			next();
		})
	}

	$scope.animateOpponentAttack = function(cb) {
		$('#opponentMoveImg').css({position: 'relative'})
		.animate({right: '+=8em'}, 100).delay(100)
		.animate({right: '-=8em'}, 100).delay(100)
		.queue(function(next){
			cb();
			next();
		})
	}

	$scope.init();
}]);