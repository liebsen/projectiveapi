var moment = require('moment');


exports.isThisPeriod = function(d,p) {
  // start and end of this month
  if(p===undefined) p = 'month'
  var last = [
    moment().utc().startOf(p),
    moment().utc().endOf(p)
  ];
  return d.isBetween(last[0],last[1])||d.isSame(last[0])||d.isSame(last[1]);
}

exports.isPeriod = function(d,i,p) {
  var cp = p
  if(i===undefined) i = 1
  if(p===undefined) p = 'month'
  if(i>1) p+= 's'
  // start and end of this month minus 1, which is last month
  if(i){
    var last = [
      moment().subtract(i,p).utc().startOf(cp),
      moment().subtract(i,p).utc().endOf(cp)
    ];
  } else {
    var last = [
      moment().utc().startOf(cp),
      moment().utc().endOf(cp)
    ];
  }

  return d.isBetween(last[0],last[1])||d.isSame(last[0])||d.isSame(last[1]);
}