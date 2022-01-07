function groupActivities(data) {
    var parseDate = d3.timeParse("%Y-%m-%d");

    //data = data.filter(d => d.type == 'Run');

    const month = new Array();month[0] = "Jan";month[1] = "Feb";month[2] = "Mar";month[3] = "Apr";month[4] = "May";month[5] = "June";month[6] = "July";month[7] = "Aug";month[8] = "Sep";month[9] = "Oct";month[10] = "Nov";month[11] = "Dec";

    data.forEach(function(d, i){
        d.mileage = +d.mileage;
        d.date = parseDate(d.start_date_local.split("T")[0]);
        d.year = d.date.getFullYear();
        d.month = month[d.date.getMonth()] + " " + d.year;
    });

    return d3.nest().key(function(d){return d.month;}).rollup(function(activities){
        return d3.sum(activities, function(d) {return (d.miles)});
    }).entries(data);
}

function callTooltip(d, text) {
    tooltip
        .style("visibility", "visible")
        .html(text)
        .transition().duration(250)
        .style("left", function() {
            // if mouse is on left 80% of screen, show tooltip to right of cursor
            if (d3.event.pageX / window.innerWidth < .8){
                return d3.event.pageX + 10 + "px"  
            }
            else { // show tooltip to left of cursor
                return d3.event.pageX - document.querySelector('.tooltip').offsetWidth - 10 + "px" 
            }
        }) 
        .style("top", d3.event.pageY + 10 + "px"); 
}

function mileagePlot(activitiesData) {

    var data = groupActivities(activitiesData);

    if (screen.width < 600) { // mobile
        var margin = {top: 20, right: 50, bottom: 50, left: 50};
        var height = window.innerHeight * .8 - margin.left - margin.right;
        var width = window.innerWidth * .95 - margin.top - margin.bottom;
        var numTicks = 3;
    }
    else { // larger device
        var margin = {top: 30, right: 50, bottom: 50, left: 50};
        var height = window.innerHeight * .8 - margin.top - margin.bottom;
        var width = window.innerWidth * .9 - margin.left - margin.right;
        var numTicks = 8;
    }
    var padding = 10;

    ////////////// the viz ///////////////
    svg = d3.select('#mileageLineplot').append("svg")
        .attr("width",  width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // get max values of mileage and pace columns.
    // if I'm ahead of pace, my mileage will exceed pace. And vice versa. 
    // regardless, the higher value should cap the y-axis
    const maxMileage = d3.max(data, d => d.value);

    data.forEach(function(d, i) {
        d.index = i;
    });

    // set the ranges
    x = d3.scaleLinear().range([padding, width - padding]).domain(d3.extent(data, function(d) { return d.index; }));
    y = d3.scaleLinear().range([height - padding, padding]).domain([0, maxMileage]);

    // add X axis
    //var xAxis = d3.axisBottom(x).ticks(numTicks).tickFormat(d3.timeFormat("%b '%y"));
    var xAxis = d3.axisBottom(x).ticks(numTicks).tickSizeOuter(0).tickFormat(function (d) {
        if (Math.floor(d) != d) {
            return;
        }
		return data[d].key;
	});
    svg.append("g")
            .attr("class", "axis")
            //.attr("id", "x_axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis);

    //  Add the Y Axis
    yAxis = svg.append("g").attr("class", "axis").call(d3.axisLeft(y).tickSizeOuter(0));
    svg.append("text")
      .attr("y", 5)
      .attr("x", 10)
      .attr("dy", "1em")
      .style("text-anchor", "start")
      .style("fill", "#222")
      .attr("class", "yAxisLabel")
      .text("Mileage"); 

    // compute line function
    var mileageLine = d3.line()
        .x(function(d) { return x(d.index); })
        .y(function(d) { return y(d.value);  })
        .curve(d3.curveCatmullRom);

    // draw mileage line
    svg.append("path")
        .data([data]) 
        .attr("class", "mileage_line")  
        .attr("d", mileageLine); 

    // draw dots
    svg.selectAll(".dot")
        .data(data)
        .enter()
        .append("circle") 
        .attr("class", "dot") 
        .attr("cx", function(d) {return x(d.index)})
        .attr("cy", function(d) {return y(d.value)})
        .on("mouseover", function(d) { callTooltip(d, d.key + "<br>" + d.value.toFixed(1) + " miles") })
        .on("mouseout", function() {
            tooltip.style("visibility", "hidden");
        });  
}

function drawBeeswarm(data) {
    if (screen.width < 600) { // mobile
        var margin = {top: 20, right: 50, bottom: 50, left: 50};
        var height = window.innerHeight * .8 - margin.left - margin.right;
        var width = window.innerWidth * .95 - margin.top - margin.bottom;
        var numTicks = 3;
    }
    else { // larger device
        var margin = {top: 30, right: 100, bottom: 50, left: 50};
        var height = window.innerHeight * .5 - margin.top - margin.bottom;
        var width = window.innerWidth * .8 - margin.left - margin.right;
        var numTicks = 8;
    }
    var padding = 10;

    ////////////// the viz ///////////////
    var svg = d3.select('#beeswarm').append("svg")
        .attr("width",  width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var formatValue = d3.format(",d");

    var x = d3.scaleLinear()
        .rangeRound([0, width]);

    var g = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
        .attr("id", "beeswarm-g");

    x.domain(d3.extent(data, function(d) { return d.miles; }));

    var simulation = d3.forceSimulation(data)
        .force("x", d3.forceX(function(d) { return x(d.miles); }).strength(5))
        .force("y", d3.forceY(height / 2))
        .force("collide", d3.forceCollide(7))
        .stop();

    for (var i = 0; i < 120; ++i) simulation.tick();

    g.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x).ticks(10).tickSizeOuter(0));

    var cell = g.append("g")
        .attr("class", "cells")
        .selectAll("g").data(d3.voronoi()
            .extent([[-margin.left, -margin.top], [width + margin.right, height + margin.top]])
            .x(function(d) { return d.x; })
            .y(function(d) { return d.y; })
        .polygons(data)).enter().append("g");

    cell.append("circle")
        .attr("class", "bee")
        .attr("cx", function(d) { return d.data.x; })
        .attr("cy", function(d) { return d.data.y; })
        .on("mouseover", function(d) { 
            d3.select(this).raise(); 
            callTooltip(d, d.data.name + "<br><hr>" + d.data.start_date.split("T")[0] + "<br>" + d.data.miles.toFixed(1) + " miles");
        })
        .on("mouseout", function() {
            tooltip.style("visibility", "hidden");
        })
        .on("click", function(d) { 
            var url = "https://www.strava.com/activities/" + d.data.id;
            window.open(url, '_blank').focus();
        });

    cell.append("path").attr("d", function(d) { return "M" + d.join("L") + "Z"; });
}

function updateBeeswarm(data) {
    if (screen.width < 600) { // mobile
        var margin = {top: 20, right: 50, bottom: 50, left: 50};
        var height = window.innerHeight * .8 - margin.left - margin.right;
        var width = window.innerWidth * .95 - margin.top - margin.bottom;
        var numTicks = 3;
    }
    else { // larger device
        var margin = {top: 30, right: 100, bottom: 50, left: 50};
        var height = window.innerHeight * .5 - margin.top - margin.bottom;
        var width = window.innerWidth * .8 - margin.left - margin.right;
        var numTicks = 8;
    }

    var x = d3.scaleLinear()
        .rangeRound([0, width])
        .domain(d3.extent(data, function(d) { return d.miles; }));

    var simulation = d3.forceSimulation(data)
        .force("x", d3.forceX(function(d) { return x(d.miles); }).strength(5))
        .force("y", d3.forceY(height / 2))
        .force("collide", d3.forceCollide(7))
        .stop();

    for (var i = 0; i < 120; ++i) simulation.tick();

    d3.select("#beeswarm").select(".axis--x").call(d3.axisBottom(x).ticks(10).tickSizeOuter(0));

    d3.select("#beeswarm").select(".cells").remove();

    var g = d3.select("#beeswarm").select("#beeswarm-g");

    var cell = g.append("g")
        .attr("class", "cells")
        .selectAll("g").data(d3.voronoi()
            .extent([[-margin.left, -margin.top], [width + margin.right, height + margin.top]])
            .x(function(d) { return d.x; })
            .y(function(d) { return d.y; })
        .polygons(data)).enter().append("g");

    cell.append("circle")
        .attr("class", "bee")
        .attr("cx", function(d) { return d.data.x; })
        .attr("cy", function(d) { return d.data.y; })
        .on("mouseover", function(d) { 
            d3.select(this).raise(); 
            callTooltip(d, d.data.name + "<br><hr>" + d.data.start_date.split("T")[0] + "<br>" + d.data.miles.toFixed(1) + " miles");
        })
        .on("mouseout", function() {
            tooltip.style("visibility", "hidden");
        })
        .on("click", function(d) { 
            var url = "https://www.strava.com/activities/" + d.data.id;
            window.open(url, '_blank').focus();
        });

    cell.append("path").attr("d", function(d) { return "M" + d.join("L") + "Z"; });
}