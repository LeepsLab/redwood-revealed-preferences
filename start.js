RedwoodRevealedPreferences.controller("RPStartController", 
    ["$scope",
     "RedwoodSubject",
     "SynchronizedStopWatch",
     "RPTatonnement",
     "RPEndowmentAssignment",
     "ConfigManager",
    function ($scope, rs, stopWatch, ta, ea, configManager) {

    // module private variables
    var tatonnement;

    function animateLimits () {
        var larger = $scope.intercepts.x > $scope.intercepts.y
            ? $scope.intercepts.x
            : $scope.intercepts.y;

        var lastLimits = rs.self.get("rp.last_limits");

        var baseLimits = {};
        baseLimits.x = $scope.currentRound > 1 ? lastLimits.x : $scope.limits.x;
        baseLimits.y = $scope.currentRound > 1 ? lastLimits.y : $scope.limits.y;

        $(baseLimits).animate({x: larger, y: larger}, {
            duration: $scope.config.limitAnimDuration,
            easing: "easeInOutCubic",
            step: function (now, fx) {
                if (!$scope.$$phase) {
                    $scope.$apply(function () {
                        $scope.limits[fx.prop] = now;
                    })
                } else {
                    $scope.limits[fx.prop] = now;
                }
            }
        });

        rs.set("rp.last_limits", {x: larger, y: larger});
    }

    rs.on_load(function () {

        function extractConfigEntry (entry, index) {
            return $.isArray(entry) ? entry[userIndex] : entry
        }

        var userIndex = (parseInt(rs.user_id) - 1) % 2;
        $scope.config = configManager.loadPerSubject(rs, {
            Ex                      : 0,       // Endowment, Price and Probability Options
            Ey                      : 0,
            Price                   : 1,
            ProbX                   : 0.5,
            useDefaultSelection     : false,
            epsilon1                : 1,        // Tatonnement Options
            epsilon2                : 2,
            roundsUnderEpsilon      : 2,
            expectedExcess          : 13.5,
            priceLowerBound         : 0.01,
            priceUpperBound         : 100.0,
            maxAngularDiff          : 0.26175,
            marketMaker             : true,
            snapPriceToGrid         : false,
            priceGrid               : [0.2, 0.28, 0.36, 0.43, 0.5, 0.57, 0.64, 0.7, 0.76, 0.83, 0.89, 0.94, 1, 1.06, 1.13, 1.21, 1.31, 1.43, 1.57, 1.75, 2, 2.33, 2.81, 3.57, 5],
            weightVector            : [0.1745, 0.08725, 0.043625, 0.021813, 0.010906],
            computeEndowment        : false,   // Endowment Assignment Options
            Ax                      : 100,     // Ax, Ay, Bx, By - Used if computeEndowment is true
            Ay                      : 0,       // - must be the same values as the two sets of Ex and Ey
            Bx                      : 0,       // - this is assuming only 2 different sets of endowments are being used.
            By                      : 50,        
            minimizeEquilibriumPrice: false,
            saveAllocation          : false,
            XLimit                  : 100,     // Visual Options
            YLimit                  : 100,
            labelX                  : "X",
            labelY                  : "Y",
            limitAnimDuration       : 0,
            plotResult              : true,
            showEndowment           : true,
            showTable               : false,
            showMaxPayouts          : false,
            constraintsX            : false,   // Interaction Options
            rounds                  : 1,       // Timing Options
            delay                   : 5,
            timeLimit               : 0,
            pause                   : false,
        });

        $scope.endowment = {
            x: $scope.config.Ex,
            y: $scope.config.Ey
        }
        if ($scope.config.computeEndowment) {
            console.log(rs.self.user_id)
            $scope.endowment = ea.getAssignedEndowment(rs.self.user_id, {
                endowmentA: {x: $scope.config.Ax, y: $scope.config.Ay},
                endowmentB: {x: $scope.config.Bx, y: $scope.config.By},
                minimizeEquilibriumPrice: $scope.config.minimizeEquilibriumPrice
            });
// FOR TEST
// $scope.grouping = ea.getGroupings(rs.self.user_id, {
//     endowmentA: {x: $scope.config.Ax, y: $scope.config.Ay},
//     endowmentB: {x: $scope.config.Bx, y: $scope.config.By},
//     minimizeEquilibriumPrice: $scope.config.minimizeEquilibriumPrice
// });
// END FOR TEST
        }

        if ($scope.config.showEndowment) {
            $scope.shownEndowment = $scope.endowment;
        }

        $scope.currentRound = 0;
        $scope.inputEnabled = false;

        tatonnement = ta.TatonnementAlgorithm($scope.config);

        rs.trigger("rp.configuration", $scope.config);
        rs.trigger("rp.endowment", $scope.endowment);
        rs.trigger("rp.next_round");

        if ($scope.config.saveAllocation) {
            ea.save();
        }
    });

    rs.on("rp.next_round", function () {

        //Reset the text on the button to reflect that it is 'active'
        $scope.ButtonText = "Confirm";
        $scope.waiting = true;

        // Begin next round
        $scope.currentRound++;
        $scope.cursor = undefined;
        $scope.selection = null;
        if ($scope.config.useDefaultSelection) {
            $scope.selection = [$scope.endowment.x, $scope.endowment.y];
        }
        rs.trigger("rp.selection", $scope.selection);

        // set initial price
        var price = rs.self.get("rp.price");
        $scope.price = $scope.currentRound > 1 ? price : $scope.config.Price;
        console.log("price: " + $scope.price);

        // find x and y intercepts
        $scope.intercepts = {};
        $scope.intercepts.x = $scope.endowment.x + $scope.endowment.y / $scope.price;
        $scope.intercepts.y = $scope.endowment.y + $scope.price * $scope.endowment.x;

        // set plot limits
        $scope.limits = {};
        $scope.limits.x = $scope.config.XLimit ? $scope.config.XLimit : $scope.intercepts.x;
        $scope.limits.y = $scope.config.YLimit ? $scope.config.YLimit : $scope.intercepts.y;
        animateLimits();

        // set budget functions
        $scope.budgetFunction = function (x) {
            return $scope.endowment.y + $scope.price * ($scope.endowment.x - x);
        }
        $scope.inverseBudgetFunction = function (y) {
            return $scope.endowment.x + ($scope.endowment.y - y) / $scope.price;
        }

        rs.trigger("rp.round_started", {
            "round": $scope.currentRound,
            "endowment": $scope.endowment,
            "price": $scope.price
        });
        $scope.inputEnabled = true;

        // flash the Confirm Selection button to alert the subject that a new round started
        // ooh the dirty dirty JQuery (.n.)
        var confirmButton = $("#confirmButton");
        confirmButton.effect("highlight", {color: "#c6feb6"}, 500, function() {
            confirmButton.effect("highlight", {color: "#c6feb6"}, 500);
        });


        /*****************************************
         * BEGIN TEST
         * Depends on assignment.js
         * Test code must be uncommented in start.js and assignment.js
         * Test will only work when run with 6 subjects
         *****************************************/
        // var m = {};
        // m.x = ($scope.endowment.y + $scope.price * $scope.endowment.x) / (1 + $scope.price);
        // m.y = m.x;

        // var b = {};
        // if ($scope.endowment.x != 0) {
        //     if ($scope.price <= 1) {
        //         b.x = $scope.endowment.x;
        //         b.y = $scope.endowment.y;
        //     } else {
        //         b.x = 0;
        //         b.y = ($scope.price * $scope.endowment.x);
        //     }
        // } else {
        //     if ($scope.price >= 1) {
        //         b.x = $scope.endowment.x;
        //         b.y = $scope.endowment.y;
        //     } else {
        //         b.x = ((1 / $scope.price) * $scope.endowment.y);
        //         b.y = 0;
        //     }
        // }

        // var a = {};
        // a.x = ((2/3) * m.x) + ((1/3) * b.x);
        // a.y = ((2/3) * m.y) + ((1/3) * b.y);

        // var c = {};
        // c.x = ((1/4) * m.x) + ((3/4) * b.x);
        // c.y = ((1/4) * m.y) + ((3/4) * b.y);

        // var mychoice = {};
        // if (!$scope.config.computeEndowment) {
        //     if (rs.self.user_id % 3 == 0) {
        //         mychoice.x = m.x;
        //         mychoice.y = m.y;
        //     } else if (rs.self.user_id % 3 == 1) {
        //         mychoice.x = a.x;
        //         mychoice.y = a.y;
        //     } else {
        //         mychoice.x = c.x;
        //         mychoice.y = c.y;
        //     }
        // } else {
        //     if (($scope.grouping / 7) === 1 || ($scope.grouping / 7) === 2 ||
        //         ($scope.grouping / 7) === 3 || ($scope.grouping / 7) === 4 ||
        //         ($scope.grouping / 7) === 5 || ($scope.grouping / 7) === 6 ||
        //         ($scope.grouping / 17) === 1 || ($scope.grouping / 17) === 2 ||
        //         ($scope.grouping / 17) === 3 || ($scope.grouping / 17) === 4 ||
        //         ($scope.grouping / 17) === 5 || ($scope.grouping / 17) === 6) {

        //         mychoice.x = m.x;
        //         mychoice.y = m.y;
        //     } else if ( ($scope.grouping / 11) === 1 || ($scope.grouping / 11) === 2 ||
        //                 ($scope.grouping / 11) === 3 || ($scope.grouping / 11) === 4 ||
        //                 ($scope.grouping / 11) === 5 || ($scope.grouping / 11) === 6 ||
        //                 ($scope.grouping / 19) === 1 || ($scope.grouping / 19) === 2 ||
        //                 ($scope.grouping / 19) === 3 || ($scope.grouping / 19) === 4 ||
        //                 ($scope.grouping / 19) === 5 || ($scope.grouping / 19) === 6) {

        //         mychoice.x = a.x;
        //         mychoice.y = a.y;
        //     } else {             
        //         mychoice.x = c.x;
        //         mychoice.y = c.y;
        //     }
        // }
        // $scope.selection = [mychoice.x, mychoice.y];
        // rs.trigger("rp.selection", $scope.selection);
        // $scope.confirm();

        /****************************************
         * END TEST
         ****************************************/

        // setup timer
        if ($scope.config.timeLimit > 0) {
            if (!$scope.stopWatch) {
                $scope.timeRemaining = 0;
                // The round which this timer was started
                $scope.timerRound = $scope.currentRound;
                $scope.stopWatch = stopWatch.instance()
                    .frequency(1)
                    .duration($scope.config.timeLimit)
                    .onTick(function (tick, t) {
                        $scope.timeRemaining = $scope.timeTotal - t;
                    })
                    .onComplete(function () {
                        $scope.confirm();
                        $scope.stopWatch = null;
                    }).start();
            } else {
                $scope.stopWatch.duration($scope.stopWatch.getDurationInTicks() + $scope.config.timeLimit - $scope.timeRemaining)
            }

            $scope.timeTotal = $scope.stopWatch.getDurationInTicks();
        }
    });

    rs.on("rp.selection", function (selection) {
        $scope.selection = selection;
    })

    rs.on("rp.confirm", function (position) {
        $scope.inputEnabled = false; // for recovery

        //Switch text on the button so that participant knows button has been pressed
        $scope.ButtonText = "Confirmed";
        $scope.waiting = false;

        rs.synchronizationBarrier('rp.round_' + $scope.currentRound).then(function () {
            // Calculate current price
            var currentPrice = $scope.price;

            // Check if current price is "in the grid"
            var inGrid = false;
            for (var i = 0; i < $scope.config.priceGrid.length; i++){
                if (currentPrice === $scope.config.priceGrid[i]) {
                    inGrid = true;
                }
            }

            // Compute tatonnement data for this round
            var subjectData = ta.getSubjectData(rs.subjects);
            var roundContext = ta.RoundContext(currentPrice, subjectData);

            // Add excess demand to history
            tatonnement.addExcessDemand(roundContext.excessDemand);

            // check if demand is under either threshold (epsilon1, epsilon2)
            var roundsUnder1 = rs.self.get("rp.rounds_under_epsilon1");
            if (Math.abs(roundContext.excessDemandPerCapita) < $scope.config.epsilon1) {
                roundsUnder1 += 1;
            } else {
                roundsUnder1 = 0;
            }
            rs.set("rp.rounds_under_epsilon1", roundsUnder1);
            // epsilon2 has the added condition that the price not be in the grid
            var roundsUnder2 = rs.self.get("rp.rounds_under_epsilon2");
            if (!inGrid && Math.abs(roundContext.excessDemandPerCapita) < $scope.config.epsilon2) {
                roundsUnder2 += 1;
            } else {
                roundsUnder2 = 0;
            }
            rs.set("rp.rounds_under_epsilon2", roundsUnder2);

            // If demand has been under threshold for @roundsUnderEpsilon rounds,
            // or if the maximum number of rounds have been played, stop tatonnement
            if (   roundsUnder1        >= $scope.config.roundsUnderEpsilon
                || roundsUnder2        >= $scope.config.roundsUnderEpsilon
                || $scope.currentRound >= $scope.config.rounds) {

                var actualAllocation = tatonnement.adjustedAllocation(
                    $scope.selection,
                    $scope.endowment,
                    roundContext,
                    $scope.config.marketMaker);

                $scope.selection = [actualAllocation.x, actualAllocation.y];

                // reset rounds under epsilon
                rs.set("rp.rounds_under_epsilon1", 0);
                rs.set("rp.rounds_under_epsilon2", 0);

                rs.trigger("rp.perform_allocation", actualAllocation);
                return;
            }

            // Get adjusted price
            var newPrice = tatonnement.adjustedPrice(roundContext);

            // Proceed to next round
            rs.set("rp.price", newPrice);
            rs.trigger("rp.next_round");
        });
    });

    // Recieve result (whether X or Y was chosen) from admin.
    // This result is really only used for practice rounds.
    rs.on("rp.result", function (result) {
        result.period = rs.period;
        rs.set("rp.results", result);

        if($scope.config.plotResult) {
            $scope.finalResult = result;
            rs.next_period($scope.config.delay);
        } else {
            rs.next_period();
        }
    });

    $scope.$on("rpPlot.click", function (event, selection) {
        rs.trigger("rp.selection", selection);
    });

    $scope.confirm = function () {
        $scope.inputEnabled = false;
        rs.trigger("rp.confirm", {
            "round": $scope.currentRound,
            "x": $scope.selection[0],
            "y": $scope.selection[1]
        });
    };
}]);
