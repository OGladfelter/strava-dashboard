var zoomExtent = 13, speed = 4, startingColor = 'red', endingColor = '#0e005e';

// initialize maps
var map = L.map('heatmap', {minZoom:zoomExtent, maxZoom:zoomExtent, maxBoundsViscosity:1, zoomControl:false});
map.setMaxBounds([[40.647789,-74.022393], [40.730217,-73.912763]]);
map.dragging.disable();

// map options - terrain, light, and dark
mapTilesTerrain = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: zoomExtent,continuousWorld: false,noWrap: true});
mapTilesLight = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {maxZoom: zoomExtent,continuousWorld: false,noWrap: true});
mapTilesDark = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', {maxZoom: zoomExtent,continuousWorld: false,noWrap: true});

map.addLayer(mapTilesLight); // default to light map

// read and map data
function animateHeatmap(data, fastForward = 'N') {
    
    data.forEach(function(d){ 
        d.summary_polyline = d.map.summary_polyline;
    });

    // filter out activities without a summary polyline
    data = data.filter(d => d.summary_polyline != "" && d.summary_polyline != undefined);
    data = data.filter(d => d.type == "Run");

    // setView of map on a given position (using 40.655239,-73.972084)
    map.setView([40.655239, -73.972084], zoomExtent);

    // draw the activity lines onto the map
    paths = {}
    for (i=0; i<data.length; i++){
        
        var coordinates = L.Polyline.fromEncoded(data[i].summary_polyline).getLatLngs();

        paths[data[i].id] = L.polyline(
            coordinates,
            {
                color: startingColor,
                weight: 2,
                opacity: 1,
                lineJoin: 'round',
            },
        )
        .addTo(map);
        //.bindTooltip(data[i].name + "<br>" + data[i].miles + " miles<br>" + data[i].start_date_local.split("T")[0], {sticky: true, className: 'myCSSClass'});
    }

    function delayLength(i, total_length = 0){
        //Use recursion to find sum of all previous line lengths
        if (i==0){
        return total_length
        } 
        else{
        return (speed * d3.select("#heatmap").selectAll("path")._groups[0][i - 1].getTotalLength()) + delayLength(i-1, total_length)
        }
    }

    // set opacity of all lines and animate them
    d3.select("#heatmap").selectAll("path")
        .style("opacity", 1)
        .attr('stroke-dasharray', function(d, i){ return this.getTotalLength();}) // line starts completely in a dash offset
        .attr('stroke-dashoffset', function(d){ return this.getTotalLength();})
        .transition()
        .duration(function(d){ return speed * this.getTotalLength();}) // makes animation time correspond to length of run line
        .ease(d3.easeLinear)
        .delay(function(d,i) {
            if (fastForward == 'N') { return delayLength(i) }
            else {return 0}
        }) // remove this to start all lines animations at the same time
        .attr('stroke-dashoffset', 0) // transition dash offset to 0, creating animation illusion
        .transition()
        .duration(1000)
        .style("opacity", 0.3) // fade line out
        .style("stroke", endingColor); // fade line to endingColor value    
}

function replay() {
    d3.selectAll('path').remove();
    animateHeatmap();
}

function fastForward() {
    d3.selectAll('path').remove();
    animateHeatmap('Y');
}