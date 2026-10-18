/*
   Licensed to the Apache Software Foundation (ASF) under one or more
   contributor license agreements.  See the NOTICE file distributed with
   this work for additional information regarding copyright ownership.
   The ASF licenses this file to You under the Apache License, Version 2.0
   (the "License"); you may not use this file except in compliance with
   the License.  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
var showControllersOnly = false;
var seriesFilter = "";
var filtersOnlySampleSeries = true;

/*
 * Add header in statistics table to group metrics by category
 * format
 *
 */
function summaryTableHeader(header) {
    var newRow = header.insertRow(-1);
    newRow.className = "tablesorter-no-sort";
    var cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Requests";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 3;
    cell.innerHTML = "Executions";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 7;
    cell.innerHTML = "Response Times (ms)";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Throughput";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 2;
    cell.innerHTML = "Network (KB/sec)";
    newRow.appendChild(cell);
}

/*
 * Populates the table identified by id parameter with the specified data and
 * format
 *
 */
function createTable(table, info, formatter, defaultSorts, seriesIndex, headerCreator) {
    var tableRef = table[0];

    // Create header and populate it with data.titles array
    var header = tableRef.createTHead();

    // Call callback is available
    if(headerCreator) {
        headerCreator(header);
    }

    var newRow = header.insertRow(-1);
    for (var index = 0; index < info.titles.length; index++) {
        var cell = document.createElement('th');
        cell.innerHTML = info.titles[index];
        newRow.appendChild(cell);
    }

    var tBody;

    // Create overall body if defined
    if(info.overall){
        tBody = document.createElement('tbody');
        tBody.className = "tablesorter-no-sort";
        tableRef.appendChild(tBody);
        var newRow = tBody.insertRow(-1);
        var data = info.overall.data;
        for(var index=0;index < data.length; index++){
            var cell = newRow.insertCell(-1);
            cell.innerHTML = formatter ? formatter(index, data[index]): data[index];
        }
    }

    // Create regular body
    tBody = document.createElement('tbody');
    tableRef.appendChild(tBody);

    var regexp;
    if(seriesFilter) {
        regexp = new RegExp(seriesFilter, 'i');
    }
    // Populate body with data.items array
    for(var index=0; index < info.items.length; index++){
        var item = info.items[index];
        if((!regexp || filtersOnlySampleSeries && !info.supportsControllersDiscrimination || regexp.test(item.data[seriesIndex]))
                &&
                (!showControllersOnly || !info.supportsControllersDiscrimination || item.isController)){
            if(item.data.length > 0) {
                var newRow = tBody.insertRow(-1);
                for(var col=0; col < item.data.length; col++){
                    var cell = newRow.insertCell(-1);
                    cell.innerHTML = formatter ? formatter(col, item.data[col]) : item.data[col];
                }
            }
        }
    }

    // Add support of columns sort
    table.tablesorter({sortList : defaultSorts});
}

$(document).ready(function() {

    // Customize table sorter default options
    $.extend( $.tablesorter.defaults, {
        theme: 'blue',
        cssInfoBlock: "tablesorter-no-sort",
        widthFixed: true,
        widgets: ['zebra']
    });

    var data = {"OkPercent": 55.21513854471728, "KoPercent": 44.78486145528272};
    var dataset = [
        {
            "label" : "FAIL",
            "data" : data.KoPercent,
            "color" : "#FF6347"
        },
        {
            "label" : "PASS",
            "data" : data.OkPercent,
            "color" : "#9ACD32"
        }];
    $.plot($("#flot-requests-summary"), dataset, {
        series : {
            pie : {
                show : true,
                radius : 1,
                label : {
                    show : true,
                    radius : 3 / 4,
                    formatter : function(label, series) {
                        return '<div style="font-size:8pt;text-align:center;padding:2px;color:white;">'
                            + label
                            + '<br/>'
                            + Math.round10(series.percent, -2)
                            + '%</div>';
                    },
                    background : {
                        opacity : 0.5,
                        color : '#000'
                    }
                }
            }
        },
        legend : {
            show : true
        }
    });

    // Creates APDEX table
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.14924532552376663, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.16607773851590105, 500, 1500, "S02 Dashboard GET /api/auth/me"], "isController": false}, {"data": [0.20302375809935205, 500, 1500, "S03 Dashboard GET /api/profile/me"], "isController": false}, {"data": [0.776595744680851, 500, 1500, "S07 Medications GET /api/medications"], "isController": false}, {"data": [0.015857478465152702, 500, 1500, "S01 Log in POST /api/auth/login"], "isController": false}, {"data": [0.9591836734693877, 500, 1500, "S06 Dashboard GET /api/health-profile"], "isController": false}, {"data": [0.5026737967914439, 500, 1500, "S04 Dashboard GET /api/profile/linked"], "isController": false}, {"data": [0.8103448275862069, 500, 1500, "S05 Dashboard GET /api/wellbeing/today"], "isController": false}, {"data": [0.5319148936170213, 500, 1500, "S08 Add medication POST /api/medications"], "isController": false}, {"data": [0.2393617021276596, 500, 1500, "S09 My health GET /api/health-profile"], "isController": false}, {"data": [0.037037037037037035, 500, 1500, "S10 Water and sleep GET /api/wellbeing/today"], "isController": false}, {"data": [0.014705882352941176, 500, 1500, "S12 Log out POST /api/auth/logout"], "isController": false}, {"data": [0.05172413793103448, 500, 1500, "S11 Water and sleep GET /api/wellbeing/history"], "isController": false}]}, function(index, item){
        switch(index){
            case 0:
                item = item.toFixed(3);
                break;
            case 1:
            case 2:
                item = formatDuration(item);
                break;
        }
        return item;
    }, [[0, 0]], 3);

    // Create statistics table
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 4439, 1988, 44.78486145528272, 21382.907636855125, 5, 30043, 25843.0, 30015.0, 30016.0, 30017.0, 45.75816926090094, 79.10654547533758, 11.495613371044222], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["S02 Dashboard GET /api/auth/me", 566, 0, 0.0, 16823.786219081263, 6, 23502, 22267.0, 22595.9, 22667.0, 22883.850000000002, 7.722956009169304, 7.7241952340424085, 3.6002014313393738], "isController": false}, {"data": ["S03 Dashboard GET /api/profile/me", 463, 0, 0.0, 18483.133909287262, 5, 26313, 22583.0, 26067.2, 26181.8, 26288.52, 5.234595816845675, 5.220275844403618, 2.4559249576031656], "isController": false}, {"data": ["S07 Medications GET /api/medications", 94, 0, 0.0, 1312.9574468085104, 6, 9319, 9.0, 6502.5, 9052.25, 9319.0, 4.294786859779778, 3.4964747909718095, 2.08724785260657], "isController": false}, {"data": ["S01 Log in POST /api/auth/login", 2554, 1988, 77.83868441660141, 27001.914252153532, 216, 30043, 30006.0, 30016.0, 30017.0, 30018.0, 26.327182764663437, 60.066304778502214, 2.0283830275229358], "isController": false}, {"data": ["S06 Dashboard GET /api/health-profile", 98, 0, 0.0, 1074.1326530612243, 6, 26140, 9.0, 18.0, 1323.549999999926, 26140.0, 1.1620874885866408, 1.19912068960406, 0.5681434985355326], "isController": false}, {"data": ["S04 Dashboard GET /api/profile/linked", 187, 0, 0.0, 11619.780748663103, 5, 26296, 21.0, 25842.2, 26105.0, 26181.600000000002, 2.1144995872768186, 1.7119796437011658, 1.0016399386003596], "isController": false}, {"data": ["S05 Dashboard GET /api/wellbeing/today", 116, 0, 0.0, 4478.775862068965, 7, 26300, 10.0, 22829.899999999998, 24183.649999999998, 26262.77, 1.3277172420108048, 1.1741149863222233, 0.6710346250915667], "isController": false}, {"data": ["S08 Add medication POST /api/medications", 94, 0, 0.0, 5479.723404255319, 7, 22566, 28.5, 19854.0, 22511.5, 22566.0, 2.0922364672364675, 2.5779963218928064, 1.4051997084223649], "isController": false}, {"data": ["S09 My health GET /api/health-profile", 94, 0, 0.0, 11938.106382978725, 5, 25868, 9316.5, 22652.5, 24086.5, 25868.0, 1.316821696738765, 1.5699366717331615, 0.6438275296284882], "isController": false}, {"data": ["S10 Water and sleep GET /api/wellbeing/today", 81, 0, 0.0, 17447.135802469136, 8, 26315, 21892.0, 25705.2, 26078.5, 26315.0, 1.0417604465422554, 0.9214877560994431, 0.5267582119017916], "isController": false}, {"data": ["S12 Log out POST /api/auth/logout", 34, 0, 0.0, 21757.529411764706, 672, 26275, 22525.0, 25749.5, 26226.25, 26275.0, 0.4348938347403428, 0.2633146265029419, 0.21357464345101046], "isController": false}, {"data": ["S11 Water and sleep GET /api/wellbeing/history", 58, 0, 0.0, 20077.827586206902, 7, 25872, 22382.0, 24441.5, 25796.25, 25872.0, 0.7293120575402066, 0.8488911391728595, 0.37455341424924865], "isController": false}]}, function(index, item){
        switch(index){
            // Errors pct
            case 3:
                item = item.toFixed(2) + '%';
                break;
            // Mean
            case 4:
            // Mean
            case 7:
            // Median
            case 8:
            // Percentile 1
            case 9:
            // Percentile 2
            case 10:
            // Percentile 3
            case 11:
            // Throughput
            case 12:
            // Kbytes/s
            case 13:
            // Sent Kbytes/s
                item = item.toFixed(2);
                break;
        }
        return item;
    }, [[0, 0]], 0, summaryTableHeader);

    // Create error table
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 1988, 100.0, 44.78486145528272], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 4439, 1988, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 1988, "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["S01 Log in POST /api/auth/login", 2554, 1988, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 1988, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
