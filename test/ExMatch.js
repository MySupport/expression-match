var demand = require('must');

var ExMatch = require('../ExMatch');

var searchFields,searchPatterns;

/** Test Matching */

before(function() {
	
	// Create a searchfield:value object and some test search objects
	searchFields = {
		str1: 'string',
		str2: 'hello',
		str3: 'plug',
		num1: 1,
		num2: '2',
		num3: '3',
		check1:'true',
		check2: false
	}
	
	searchPatterns = {
		/* true */
		e0: { $or:[ {str1:['string1']} , {check1:'true'} ] ,num2:'2',num1:{$lt:2}},
		e1: { $or:[ {str1:['string','third']} , {check1:'false'} ] },
		e2: { $and:[ {str1:'string'} , {check2:false} ] },
		e3: { $lte:[ {num1:1} , {num3:4} ] },
		e4: { $gt:[{num3:1}],$and:[{num1:1},{str2:'hello'},{num2:{$lt:4}}] },
		e5: { $or:[ {num1:{$gte:1}} , {num2:{$lte:1}} ] },
		e6: { str1:['string','third'] },
		e7: { $lt:{num2:3} },
		/* false */
		e8: { $or:[ {str1:['first','third']} , {check1:'false'} ] },
		e9: { $and:[ {str1:'string'} , {check2:true} ] },
		e10: { $gte:[ {num1:14} , {num3:1} ] },
		e11: { $lt:[ {num1:3} , {num3:2} ] },
		e12: { $or:[ {num1:{$gte:13}} , {num2:{$lte:1}} ] },
		e13: { str1:'string4' },
		e14: { $lte:{num2:1} }
	}
});

describe('TRUE', function() {
		
		it('$or then plain $and should be true', function() {
			/* debug is true instead of false in ExMatch */
			var m0 = new ExMatch(searchPatterns.e0,searchFields,false).match();
			demand(m0).be.true();
			m0 = undefined;
		});
		
		it('$or should be true', function() {
			var m1 = new ExMatch(searchPatterns.e1,searchFields,false).match();
			demand(m1).be.true();
			m1 = undefined;
		});
		
		it('$and should be true', function() {
			var m2 = new ExMatch(searchPatterns.e2,searchFields,false).match();
			demand(m2).be.true();
			m2 = undefined;
		});
		
		it('$lte should be true', function() {
			var m3 = new ExMatch(searchPatterns.e3,searchFields).match();
			demand(m3).be.true();
			m3 = undefined;
		});
		
		it('$gt $and should be true', function() {
			var m4 = new ExMatch(searchPatterns.e4,searchFields).match();
			demand(m4).be.true();
			m4 = undefined;
		});
		
		it('$or $gte should be true', function() {
			var m5 = new ExMatch(searchPatterns.e5,searchFields).match();
			demand(m5).be.true();
			m5 = undefined;
		});
		
		it('plain array should be true', function() {
			var m6 = new ExMatch(searchPatterns.e6,searchFields).match();
			demand(m6).be.true();
			m6 = undefined;
		});
		
		it('plain $lte should be true', function() {
			var m7 = new ExMatch(searchPatterns.e7,searchFields).match();
			demand(m7).be.true();
			m7 = undefined;
		});
		
});
	
	
describe('FALSE', function() {
		
		it('$or should be false', function() {
			var m8 = new ExMatch(searchPatterns.e8,searchFields).match();
			demand(m8).be.false();
			m8 = undefined;
		});
		
		it('$and should be false', function() {
			var m9 = new ExMatch(searchPatterns.e9,searchFields).match();
			demand(m9).be.false();
			m9 = undefined;
		});
		
		it('$gte should be false', function() {
			var m10 = new ExMatch(searchPatterns.e10,searchFields).match();
			demand(m10).be.false();
			m10 = undefined;
		});
		
		it('$lt should be false', function() {
			var m11 = new ExMatch(searchPatterns.e11,searchFields).match();
			demand(m11).be.false();
			m11 = undefined;
		});
		
		it('$or $gte should be false', function() {
			var m12 = new ExMatch(searchPatterns.e12,searchFields).match();
			demand(m12).be.false();
			m12 = undefined;
		});
		
		it('plain should be false', function() {
			var m13 = new ExMatch(searchPatterns.e13,searchFields).match();
			demand(m13).be.false();
			m13 = undefined;
		});
		
		it('plain $lte should be false', function() {
			var m14 = new ExMatch(searchPatterns.e14,searchFields).match();
			demand(m14).be.false();
			m14 = undefined;
		});
		
});