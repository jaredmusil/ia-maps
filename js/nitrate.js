$(document).ready(function() {
	function grabData(json) {
		var nitrate = [],
			mapTop = 43.50055,
			mapBottom = 40.375445,
			mapLeft = -96.639525,
			mapRight = -90.158181,
			mapHeight = mapTop - mapBottom,
			mapWidth = mapRight - mapLeft,
			canvasWidth = document.getElementById('ia-nitrate-map').width,
			canvasHeight = document.getElementById('ia-nitrate-map').height;

		// Cycle through all sites and store pulled data
		for (var i = 0; i < json.value.timeSeries.length; i++) {
			var title = json.value.timeSeries[i].sourceInfo.siteName;
			var siteCode = json.value.timeSeries[i].sourceInfo.siteCode[0].value; // SiteCode
			var url = 'http://waterdata.usgs.gov/ia/nwis/uv?cb_99133=on&format=gif_default&site_no=' + siteCode; //URL

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

			// If no "L" qualifier code, everything looks good
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
			
			nitrate.push({
				"title": title, 
				"siteCode": siteCode, 
				"value": value,
				"date": date,
				"time": time,
				"epoch": epoch,
				"url": url,
				"x": x,
				"y": y });
		}
		return nitrate;
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
				tableRow = '<tr><td id="nitrate-code-' + data[i].siteCode + '" readonly="readonly"><a target="_blank" href="' + data[i].url + '">' + data[i].siteCode + '</a></td>' +
				'<td id="nitrate-code-' + data[i].siteCode + '" readonly="readonly">' + data[i].value + '</td>' +
				'<td id="nitrate-code-' + data[i].siteCode + '" readonly="readonly">' + data[i].time + '</td>' +
				'<td id="nitrate-code-' + data[i].siteCode + '" readonly="readonly">' + data[i].date + '</td>';

				$('#ia-nitrate-table tbody').append(tableRow);
			}
		}
	}
	function populateImgMap(data) {
		for (var i = 0; i < data.length; i++) {
			$('#ia-nitrate-imgmap').append(
				'<area id="' + data[i].siteCode + 
				'" href="' + data[i].url + 
				'" title="Nitrate: ' + data[i].value + '(mg/L) Site: ' + data[i].siteCode + ' ' + data[i].title + 
				'" coords="' + data[i].x + ',' + data[i].y + ',5" shape="circle">');
		}
	}
	function plotCanvas(data) {
		var canvas = document.getElementById('ia-nitrate-map');
		
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
					oldDataSiteCount = 0,
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
						} else if (val < 0.5) {
							context.fillStyle = 'rgb(55,126,184)';    // Low
						} else if (val >= 0.5 && val < 3.0) {
							context.fillStyle = 'rgb(77,175,74)';
						} else if (val >= 3.0 && val < 5.0) {
							context.fillStyle = 'rgb(152,78,163)';
						} else if (val >= 5.0 && val < 10.0) {
							context.fillStyle = 'rgb(255,255,51)';
						} else if (val >= 10.0 && val < 20.0) {
							context.fillStyle = 'rgb(255,127,0)';
						} else if (val > 2.0) {
							context.fillStyle = 'rgb(228,26,28)';    // High
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
						realtimeData = false;  // Activate non-realtime data message
						oldDataSiteCount += 1; // Keep track of how many sites are reporting old data.
					}
					// Ignore data that's older than 90 days (259200000 milliseconds)
					else {
					}
				}
				// During the winter months, sites get taken down. Notify user of this
				if (oldDataSiteCount === data.length) {
					$('#ia-nitrate-status-container').show();
					$('#ia-nitrate-status-container').append('<p id="map-status map-status-winter">Sites opterate on a seasonal basis</p>');
				// Sites go down from time to time. Notify user that a site is reporting old data
				} else if (realtimeData === false) {
					$('#ia-nitrate-status-container').show();
					$('#ia-nitrate-status-container').append('<p class="map-status map-status-information">1 or more sites are not reporting realtime data</p>');
				}
			};
			backgroundImg.src = 'img/ia-340-blank.png';
		}	
		else {
			// Error: No canvas support
			$('#ia-nitrate-status-container').show();
			$('#ia-nitrate-status-container').append('<p class="map-status map-status-nocanvas">&lt;canvas&gt; tag unsupported.</p>');
		}
	}
	
	// Hide status bar's		
	$('#ia-nitrate-status-container').hide();

	// Pull data from server
	$.ajax({
		// url: 'proxy/nitrate.php', // To avoid "same origin" error
		url: 'https://waterservices.usgs.gov/nwis/iv/?format=json,1.1&stateCd=ia&parameterCd=99133',
		dataType: 'json',
		data: '',
		beforeSend: function(){ $('#ia-nitrate-map').addClass('loading'); },
		complete: function(){ $('#ia-nitrate-map').removeClass('loading'); },
		success: function(json){
			var data = grabData(json);
			populateTable(data);
			populateImgMap(data);
			plotCanvas(data);
			
			//TableSorter jQuery plug-in
			$('#ia-nitrate-table').tablesorter({
				sortList: [[3,1], [1,1], [2,1], [0,1]], //Sort first by date, then nitrate, time, & stationID
				widgets: ['zebra']
			});
		}
	});
});
