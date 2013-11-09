$(document).ready(function() {
	function grabData(json) {
		var gw = [],
			mapTop = 43.50055,
			mapBottom = 40.375445,
			mapLeft = -96.639525,
			mapRight = -90.158181,
			mapHeight = mapTop - mapBottom,
			mapWidth = mapRight - mapLeft,
			canvasWidth = document.getElementById('ia-groundwater-map').width,
			canvasHeight = document.getElementById('ia-groundwater-map').height;

		// Cycle through all sites and store pulled data
		for (var i = 0; i < json.value.timeSeries.length; i++) {
			var siteCode = json.value.timeSeries[i].sourceInfo.siteCode[0].value; // SiteCode
			var url = 'http://waterdata.usgs.gov/ia/nwis/uv?cb_72019&site_no=' + siteCode;

			// Find lat/long ratio then scale to size of image in whole numbers
			var longitude = json.value.timeSeries[i].sourceInfo.geoLocation.geogLocation.longitude;
			var x = Math.round(((longitude - mapLeft) / mapWidth) * canvasWidth);
			var latitude = json.value.timeSeries[i].sourceInfo.geoLocation.geogLocation.latitude;
			var y = Math.round((1-((latitude - mapBottom) / mapHeight)) * canvasHeight);

			// The "L" qualifier code stops waterservices from reporting data, makes value = undefined
			// Assume the worst, no value was found. Treat the same as a sensor error
			var timeStamp = '',
				date = '',
				time = '',
				epoch = 0,
				value = -999999;

			// Ignore "L" qualifier codes. They cause the json value to be undefined
			if (typeof json.value.timeSeries[i].values[0].value[0] === 'undefined'){
				//console.log('"L" qualifier error:', siteCode);
			} else {
				// Convert DateTime to JavaScript Epoch
				timeStamp = json.value.timeSeries[i].values[0].value[0].dateTime;
				var epochTimestamp = new Date(timeStamp);
				epoch = epochTimestamp.getTime();
				
				date = (timeStamp.substr(5,2) + '/' + timeStamp.substr(8,2) + '/' + timeStamp.substr(0,4));
				time = (timeStamp.substr(11,5));
				value = json.value.timeSeries[i].values[0].value[0].value;
			}
			
			gw.push({
				"siteCode": siteCode, 
				"value": value,
				"date": date,
				"time": time,
				"epoch": epoch,
				"url": url,
				"x": x,
				"y": y });
		}
		return gw;
	}
	function populateTable(data) {
		var tableRow = '',
			nintydays = 7776000000, // milliseconds
			epochNow = new Date().getTime();
		
		for (var i = 0; i < data.length; i++) {
			// Skip sites older than 90 days
			var dateDifference = epochNow - data[i].epoch;
			if (dateDifference > nintydays) {
				//Ignore
			} else {
				tableRow = '<tr><td id="gw-code-' + data[i].siteCode + '" readonly="readonly"><a href="' + data[i].url + '">' + data[i].siteCode + '</a></td>' +
				'<td id="gw-code-' + data[i].siteCode + '" readonly="readonly">' + data[i].value + '</td>' +
				'<td id="gw-code-' + data[i].siteCode + '" readonly="readonly">' + data[i].time + '</td>' +
				'<td id="gw-code-' + data[i].siteCode + '" readonly="readonly">' + data[i].date + '</td>';

				$('#ia-groundwater-table tbody').append(tableRow);
			}
		}
	}
	function populateImgMap(data) {
		for (var i = 0; i < data.length; i++) {
			$('#ia-groundwater-imgmap').append(
				'<area id="' + data[i].siteCode + 
				'" href="' + data[i].url +
				'" title="Groundwater: ' + data[i].value + 'ft Site: ' + data[i].siteCode +
				'" coords="' + data[i].x + ',' + data[i].y + ',5" shape="circle">');
		}
	}
	function plotCanvas(data) {
		var canvas = document.getElementById('ia-groundwater-map');
		var epochNow = new Date().getTime();

		if (canvas.getContext) {
			var context = canvas.getContext('2d');
			var backgroundImg = new Image();
				
			backgroundImg.onload = function() {
				context.drawImage(backgroundImg, 0, 0);

				var dotRadius = 5,
					startAngle = 0,
					endAngle = Math.PI * 2,
					oneday = 86400000,      // milliseconds
					nintydays = 7776000000; // milliseconds
					realtimeData = true,
					epochNow = new Date().getTime();

				// Loop for all sites
				for (var i = 0; i < data.length; i++) {
					var x = data[i].x,
						y = data[i].y,
						val = data[i].value,
						dateDifference = epochNow - data[i].epoch;

					// Draw colored circles for data within 1 day old
					if (dateDifference <= oneday) {
						context.beginPath();
						context.arc(x, y, dotRadius, startAngle, endAngle, true);
						if (val === -999999) { // Site is down/broken
							context.fillStyle = 'rgb(255,255,255)'; // White
						} else if (val < 1) {
							context.fillStyle = 'rgb(175,55,72)';   // Low
						} else if (val >= 1 && val < 5) {
							context.fillStyle = 'rgb(205,77,83)';
						} else if (val >= 5 && val < 10) {
							context.fillStyle = 'rgb(238,133,122)';
						} else if (val >= 10 && val < 20) {
							context.fillStyle = 'rgb(247,216,168)';
						} else if (val >= 20 && val < 25) {
							context.fillStyle = 'rgb(215,223,239)';
						} else if (val >= 25 && val < 30) {
							context.fillStyle = 'rgb(71,187,223)';
						} else if (val > 30) {
							context.fillStyle = 'rgb(0,112,181)';   // High
						} else {
							context.fillStyle = 'rgb(255,255,255)'; // White. Used for null vaules
						}
						context.fill();
						context.stroke();
						context.closePath();
					}
					// Draw empty circles for data that's between 24 Hours and 90 days old
					else if (dateDifference <= nintydays) {
						context.beginPath();
						context.arc(x, y, dotRadius, startAngle, endAngle, true);
						context.stroke();
						context.closePath();
						// Activate non realtime data message
						realtimeData = false;
					}
					// Ignore data that's older than 90 days (259200000 milliseconds)
					else {
						//console.log(">90 days old:       ", data[i].siteCode, data[i].date, data[i].time, data[i].value);
					}
				}
				// Sites go down from time to time. Notify user that a site is reporting old data
				if (realtimeData === false) {
					$('#ia-temperature-status-container').show();
					$('#ia-temperature-status-container').append('<p class="map-status-information">1 or more sites are not reporting realtime data</p>');
				}
			};
			backgroundImg.src = 'img/ia-340-blank.png';
		}	
		else {
			// Error: No canvas support
			$('#nitrate-status-container').append('<p class="map-status-nocanvas">&lt;canvas&gt; tag unsupported.</p>');
		}
	}
	
	// Hide status bar's		
	$('#ia-groundwater-status-container').hide();

	// Pulls data from waterwatch
	$.ajax({
		url: 'proxy/groundwater.php', // To avoid "same origin" error
		dataType: 'json',
		data: '',
		beforeSend: function(){ $('#ia-groundwater-map').addClass('loading'); },
		complete: function(){ $('#ia-groundwater-map').removeClass('loading'); },
		success: function(json){
			var data = grabData(json);
			populateTable(data);
			populateImgMap(data);
			plotCanvas(data);

			//TableSorter jQuery plug-in
			$('#ia-groundwater-table').tablesorter({
				//Sort first by date, then groundwater, time, & stationID
				sortList: [[3,1], [1,1], [2,1], [0,1]],
				widgets: ['zebra']
			});
		}
	});
});
