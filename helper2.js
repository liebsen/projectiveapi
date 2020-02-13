
var profits = [0,0,0,0]; // this/last week, this/last month
var date;

function isThisWeek(d) {
  // start and end of this week
  var thisWeek = [moment().utc().startOf('week'),
                  moment().utc().endOf('week')];
  return d.isBetween(thisWeek[0],thisWeek[1])||
  d.isSame(thisWeek[0])||
  d.isSame(thisWeek[1]);
}

function isLastWeek(d) {
  // start and end of this week minus 1, which is last week
  var lastWeek = [moment().utc().subtract(1,'weeks').startOf('week'),
                  moment().utc().subtract(1,'weeks').endOf('week')];
  return d.isBetween(lastWeek[0],lastWeek[1])||
  d.isSame(lastWeek[0])||
  d.isSame(lastWeek[1]);
}

function isThisMonth(d) {
  // start and end of this month
  var thisMonth = [moment().utc().startOf('month'),
                   moment().utc().endOf('month')];
  return d.isBetween(thisMonth[0],thisMonth[1])||
  d.isSame(thisMonth[0])||
  d.isSame(thisMonth[1]);
}

function isLastMonth(d) {
  // start and end of this month minus 1, which is last month
  var lastMonth = [moment().subtract(1,'months').utc().startOf('month'),
                   moment().subtract(1,'months').utc().endOf('month')];
  return d.isBetween(lastMonth[0],lastMonth[1])||
  d.isSame(lastMonth[0])||
  d.isSame(lastMonth[1]);
}
arr.forEach(function(e){
  date=moment.utc(e.date,'YYYY-MM-DD');
  if (isThisWeek(date)) { // if it's this week
    profits[0]+=e.profit;
  } else if (isLastWeek(date)) { // if it's last week
    profits[1]+=e.profit;
  }
  if (isThisMonth(date)) { // if it's this month
    profits[2]+=e.profit;
  } else if (isLastMonth(date)) { // if it's last month
    profits[3]+=e.profit;
  }
});
console.log("This week profits : "+profits[0]);
console.log("Last week profits : "+profits[1]);
console.log("This month profits : "+profits[2]);
console.log("Last month profits : "+profits[3]);