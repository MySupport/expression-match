const _isObject = require('lodash/isObject');
const extend = require('lodash/extend');
const isString = require('lodash/isString');
const defaults = require('lodash/defaults');
const each = require('lodash/each');
const bind = require('lodash/bind');
const every = require('lodash/every');
const keys = require('lodash/keys');
const _isArray = require('lodash/isArray');
const isFunction = require('lodash/isFunction');
const some = require('lodash/some');
const includes = require('lodash/includes');
const isRegExp = require('lodash/isRegExp');

var expressions = [
	'and',
	'any',
	'eq',
	'falsey', // in development
	'falsy', // in development
	'gt',
	'gte',
	'in',
	'lt',
	'lte',
	'ne',
	'not',
	'or',
	'regex',
	'truthy', // in development
];

var dashes = '\n----------------------------------------\n';

/**
 * Calling the module directly returns a new ExMatch instance
 * 
 * @param  {Function} fn
 * @return {Wrapper}
 */
exports = module.exports = function (match, values, opts) {
	return new ExMatch(match, values, opts);
};

/**
 * ExMatch Class
 * 
 * @param {object} match
 * @param {object} values
 * @param {boolean} debug
 */
var ExMatch = exports.ExMatch = function ExMatch(match, values, opts) {

	/* Ensure a new instance has been created.
	 * Calling Wrapper as a function will return a new instance instead.
	 * */
	if (!(this instanceof ExMatch)) {
		return new ExMatch(match, values, opts);
	}

	/*If there is not a match object assume true */
	if (!_isObject(match)) {
		return true;
	}
	/* If no values assume false */
	if (!_isObject(values)) {
		return false;
	}

	/* defaults */
	this._defaults = {
		expression: '$and',
		debug: false
	}

	/* set user defaults */
	this.setDefaults(opts);

	/* allowed expressions */
	this.expressions = expressions;

	/* container for expression comparers */
	this._search = {};

	/* default expression will always be $and if not provided */
	this.expression = this.defaults.expression;

	/* save the search fields */
	this.setSearchFields(values);

	/* save the original match */
	this._match = match;

	/* loop through the match object and push _search with expression objects
	 * objects not assigned to an expression are added into a single $and expression
	 * */
	this.addSearchParams(match);

	return this;

};

/* add public search methods to prototype */
expressionMethods(expressions);

extend(ExMatch.prototype, {
	/**
	 * check if value is an Expression
	 * @param  {string} value
	 * return expression or false
	 */
	isExp: function (key) {

		if (!isString(key)) {
			return false;
		}

		var allowed = this.expressions;

		if (key[0] === '$') {
			key = key.substr(1);
		}

		return (allowed.indexOf(key) > -1) ? '$' + key : false;

	},

	/**
	 * set the options object 
	 * @param  {object} object of key:value pairs for options
	 * return this
	 */
	setDefaults: function (opts) {
		var options = {};
		/* user defaults */
		if (!_isObject(opts)) {
			if (opts) {
				options.debug = opts;
			}
		} else {
			options = opts;
		}

		this.defaults = defaults(options, this._defaults);

		/* debug choice */
		this._debug = this.defaults.debug;
		this.debug = (this.defaults.debug === true && this.defaults.debug !== 2) ? true : false;
		this.debugComparison = this.defaults.debug === 2;

	},

	/**
	 * set the searchFields object contents with required values
	 * @param  {object} object of key:value pairs to test against
	 * return this
	 */
	setSearchFields: function (values) {
		/* save the search fields */
		this.searchFields = values;
	},

	/**
	 * set the _search object contents with required search patterns
	 * @param  {object} object of comparison key:value pairs
	 * return this
	 */
	addSearchParams: function (match) {

		if (!_isObject(match)) {
			return true;
		}

		var pushVal = _pushVal.bind(this);
		var setSearchObject = _setSearchObject.bind(this);

		if (this.debug) {
			console.log(dashes, 'CREATE NEW MATCH SEARCHES', dashes, match);
		}
		/* loop thorugh the root keys and create the _search list for the comparer */
		each(match, bind(function (val, key) {

			if (this.debug) {
				console.log(dashes, 'isExp', key, this.isExp(key));
			}

			var exp = this.isExp(key);

			/* check for an expression */
			if (!exp) {
				/* force val into an array */
				val = ensureArrayOrObject(val);

				var keepTheStrings = [];
				if (this.debug) {
					console.log('ALL match items for ' + key, val);
				}
				every(val, bind(function (item, newkey) {
					if (this.debug) {
						console.log('Add item to search for ' + newkey, item);
					}

					if (this.isExp(newkey)) {

						var exp = this.isExp(newkey);

						if (this.debug) {
							console.log('reWrap item for ' + exp, key, item);
						}
						var olditem = {};
						olditem[exp] = item;
						var obj = _reWrap.call(this, key, olditem);
						_pushExp.call(this, exp, obj);

					} else if (isString(item)) {
						if (this.debug) {
							console.log('item is a string ', item);
						}
						/* save the strings for an $in */
						keepTheStrings.push(item);

					} else {
						if (_isObject(item)) {
							exp = this.isExp(keys(item)[0]);
							if (!exp) {
								return true;
							}
						} else {
							exp = this.defaults.expression
						}
						var newObj = {}
						newObj[key] = item;
						if (this.debug) {
							console.log('SEND item to pushExp for ' + exp, key, newObj);
						}
						_pushExp.call(this, exp, newObj);
					}

					return true;
				}, this));

				if (keepTheStrings.length > 0) {
					var newObj = {}
					var newExp = _isArray(this.searchFields[key]) ? '$in' : '$or';
					newObj[newExp] = {};
					newObj[newExp][key] = keepTheStrings;
					if (this.debug) {
						console.log('SEND to pushExp from Array strings for ' + newExp, key, newObj);
					}
					_pushExp.call(this, newExp, newObj);
				}


			} else {
				if (this.debug) {
					console.log('SEND to pushExp: ', val);
				}
				_pushExp.call(this, exp, val);
			}

			function _pushExp(exp, val) {
				/* we have an expression so run */
				setSearchObject(exp);
				/* we accept arrays for expressions so loop through and add each object to the routine */
				if (_isArray(val) && this.isExp(key)) {

					if (this.debug) {
						console.log(key + ' val isArray so loop');
					}
					//return pushVal(exp,val,key);

					each(val, bind(function (obj) {
						if (!_isObject(obj)) {
							/* this is a string in an Array so we assume it is a field name that should be boolean true */
							var ret = {};
							ret[obj] = true;
							obj = ret;
						}
						if (this.debug) {
							console.log('PUSH Array for ' + key, obj);
						}
						pushVal(exp, obj, key);

					}, this));

				} else if (isString(val)) {

					/* we can accept plain objects which are now just a value so wrap it back up */
					var retObj = {}
					retObj[key] = val;
					if (this.debug) {
						console.log('PUSH plain value', retObj);
					}
					pushVal(exp, retObj, key);

				} else if (_isObject(val)) {
					if (this.debug) {
						console.log('PUSH object', val);
					}
					pushVal(exp, val, key);
				}
			}

		}, this));

		return this;

		/* private functions */

		function _setSearchObject(exp) {
			/* set the search object */
			if (!this._search[exp]) {
				this._search[exp] = {
					search: [],
					exp: exp
				}
			} else {
				this._search[exp].exp = exp;
			}
		}

		function _reWrap(key, obj) {
			// the first key in the set will be the new object key
			var newKey = keys(obj)[0];
			var pushIt = {};
			pushIt[key] = obj[newKey];

			if (!newKey || newKey == key || pushIt[key] === undefined) {
				if (this.debug) {
					console.log('failed to wrap ', key, obj, newKey);
				}
				return;
			}

			// wrap it up
			var finalObj = {}
			finalObj[newKey] = pushIt;
			if (this.debug) {
				console.log(obj, 'rewrapped to ', finalObj);
			}
			return finalObj;
		}
		function _pushVal(exp, obj, parentKey) {
			/* 
			*  We get an object that can contain an expression as the first key	
			* */
			var key = keys(obj)[0];

			/* is the first item an object */
			var isObject = _isObject(obj[key]);
			/* maybe an array */
			var isArray = _isArray(obj[key]);
			/* could be a simple array on a value key */
			//var isArrayOnPlain = ( isArray && !this.isExp(parentKey)) ? true : false;
			var isArrayOnPlain = (isArray) ? true : false;
			/* if an object get the first key to check for an expression */
			var innerKey = (isObject) ? keys(obj[key])[0] : false
			/* contents of the search object */
			var innerObject = (innerKey) ? obj[key][innerKey] : false;

			if (this.debug) {
				console.log('custom $comparer:', isFunction(obj.$comparer), 'custom $selector:', isFunction(obj.$selector));
			}
			/* Still working on the $selector and $comparer  */
			if (key === '$selector') {
				this._search[exp].$selector = obj.$selector;

			} else if (key === '$comparer') {
				this._search[exp].$comparer = obj.$comparer;

			} else if (isArrayOnPlain && !this.isExp(parentKey)) {
				/* 
				 * simple value comparison of an array
				 * the default is to wrap it in an $and search which checks for all values in an array
				 * to check for one of the values the default should be set to $or
				 *  
				 * */
				if (this.debug) {
					console.log('Array inside plain, wrap each as ' + exp, obj[key], key, innerKey, innerObject);
				}

				obj[key].forEach(function (rewrite) {
					var newObj = {};
					newObj[key] = rewrite;
					if (this.debug) {
						console.log('Add search ' + exp, newObj);
					}
					this._search[exp].search.push(newObj);
				}.bind(this));


			} else if (this.isExp(key)) {
				/* top level expression so create a new match */
				if (this.debug) {
					console.log('ADD search for new top expression as $match ' + exp, obj);
				}
				if (!isObject) {
					var obj = _reWrap.call(this, parentKey, obj);
				}
				this._search[exp].search.push({ '$match': new ExMatch(obj, this.searchFields, this._debug) });

			} else if (this.isExp(innerKey)) {
				/* comparison inside a value key 
				 * invert the keys
				 * */
				var newObj = _reWrap.call(this, key, obj[key]);

				if (this.debug) {
					console.log('ADD search for inner exp as $match ' + exp, newObj);
				}

				this._search[exp].search.push({ '$match': new ExMatch(newObj, this.searchFields, this._debug) });

			} else if (isArrayOnPlain && this.isExp(parentKey)) {
				/* 
				 * simple value comparison of an array
				 * the default is to wrap it in an $and search which checks for all values in an array
				 * to check for one of the values the default should be set to $or
				 *  
				 * */
				var pExp = this.isExp(parentKey);

				if (this.debug) {
					console.log('Array inside plain, wrap each as ' + pExp, key, obj[key]);
				}

				obj[key].forEach(function (rewrite) {
					var newObj = {};
					newObj[key] = rewrite;
					if (this.debug) {
						console.log('push ' + pExp, newObj);
					}
					this._search[pExp].search.push(newObj);
				}.bind(this));


			} else {
				/*  regular item push onto the search array */
				if (this.debug) {
					console.log('ADD search for ' + exp, key, obj);
				}
				this._search[exp].search.push(obj);
			}
		}
	},

	/**
	 * match gives you the result of an ExMatch instance
	 * return boolean
	 */
	match: function () {

		/* If we dont have a _search object  are we still true?  since we did nothing false? */
		if (!_isObject(this._search)) {
			return true;
		}
		if (!this.searchFields) {
			return false;
		}
		/* loop the _search object and run all the requested searches */
		var ret = every(this._search, bind(function (val) {

			if (!_isArray(val.search) || val.search.length < 1) {
				if (this.debug || this.debugComparison) {
					console.log('val.search is not an array.. return true', val.search, val);
				}
				return true;
			}
			if (val.exp === false || !isFunction(this[val.exp])) {
				return true;
			}

			return this[val.exp]()

		}, this));

		if (this.debug || this.debugComparison) {
			console.log(keys(this._match) + ' final return = ' + ret, dashes);
		}

		return ret;

	},

	/**
	 * DEFAULT
	 * selector runs the selected true/false group return comparison method
	 * eg: every or some                                                                       
	 * @param  {function} group comparison method
	 * @param  {object} the search pattern object
	 * 				exp: name of the expression
	  *				search: array of objects, and may contain new expression searches
	  *				$selector: selector function(current)
	  *				$comparer: comparer function
	 * @param  {object} field:value object to test against
	 * return boolean
	 */
	selector: function (lodashLoopFunction, search, searchFields) {

		if (this.debug) {
			console.log(dashes, 'START SEARCH COMPARE', dashes);
		}

		/* we pass this as reference the entire chain so save our originals */
		this._current = {
			searchFields: this.searchFields,
			exp: this.expression,
			$comparer: search.$comparer
		};

		/* if we have a custom selector run it
		 * the custom selector should expect the pattern array
		 *  */
		if (isFunction(search.$selector)) {

			var ret = search.$selector.call(this, search.search);

		} else {

			var ret = lodashLoopFunction(search.search, bind(function (val) {

				/* run the proper method and return */
				var ret2 = lodashLoopFunction(val, bind(this.comparer, this));
				if (this.debug) {
					//console.log(search.exp, ' RESULT for', search.search, ret2);
				}
				return ret2;

			}, this));

		}
		if (this.debug) {
			console.log('FINAL RESULT for ' + search.exp, ret);
		}
		return ret;
	},


	/**
	 * DEFAULT
	 * comparer runs the final true/false group comparison method as a callback of the selector method during iteration
	 * @param  {mixed} each value of iteration - object or array
	 * @param  {string} key
	 * return boolean
	 */
	comparer: function (val, key) {

		if (key === '$match') {
			/* $match keys contain a new ExMatch instance so run match */
			if (this.debug) {
				console.log('RUN NEW ExMatch instance match()', this._current.exp);
			}
			return val.match();

		} else {

			if (this.searchFields[key] === undefined) {
				if (this.debug || this.debugComparison) {
					console.info(this._current.exp.toUpperCase() + ' SKIPPED COMPARE: searchFields[' + key + '] = ', this.searchFields[key], val, key);
				}

				return false;
			}

			/* see if the value matches 
			 * if we have a custom comparer run it
			 * the custom comparer should expect the test against variable first, then the test for variable second
			 *  */
			if (isFunction(this._current.$comparer)) {

				if (this.debug) {
					console.log(this._current.exp + ' custom comparer used');
				}
				//var matches = ensureArray(val);
				var ret = this._current.$comparer.call(this, this.searchFields[key], val);

			} else {
				/* we want an Array of objects */
				var matches = ensureArray(val);
				if (this.debug) {
					//console.log('check for matches:', matches, 'in', this.searchFields[key]);
				}
				/* does the matches array have any true outcomes */
				var ret = includes(matches, this.searchFields[key]);
			}

			if (this.debug || this.debugComparison) {
				console.log(this._current.exp.toUpperCase() + ' COMPARED: ' + ret.toString().toUpperCase(), ' compared ' + val, ' with ', this.searchFields[key], ' from ', key);
			}
			return ret;
		}
	},
	reset: function (exp) {
		if (exp) {
			if (_isObject(this._search[exp])) {
				this._search[exp] = {};
			}
		} else {
			this._search = {};
			this.expression = this.get('expression');
			this.searchFields = {};
			this._match = {};
			this._current = {};
			this.debug = false;
			this._debug = false;
			this.debugComparison = false;
		}
	},

	/* START EXPRESSION METHODS */
	/**
	 * base comparison method
	 * @param  {function} comparer function
	 * @param  {function} selector function
	 * return boolean
	 */
	$base: function (exp, lodashLoopFunction, selector, comparer) {

		var exp = this._search[exp];

		this.expression = exp.exp;

		if (!exp || exp.length < 1) {
			return true;
		}
		if (!lodashLoopFunction) {
			// default $and
			lodashLoopFunction = every;
		}
		if (!isFunction(exp.$comparer)) {
			if (comparer) {
				exp.$comparer = comparer;
			}
		}

		if (!isFunction(exp.$selector)) {
			if (selector) {
				exp.$selector = selector;
			}
		}

		/* run the selector */
		var sel = this.selector(lodashLoopFunction, exp, this.searchFields);

		return sel;

	},

	/**
	 * Expression comparers
	 * provide a iteration function if not every
	 * @param  {string} expression
	 * @param  {function} loop true/false function
	 * @param  {function} selector function
	 * @param  {function} comparer function
	 * return boolean
	 */
	/* and */
	$and: function () {
		if (!_isObject(this._search.$and)) {
			if (this.debug) {
				console.log('Tried to run and without $and object set');
			}
			return false;
		}

		return this.$base.call(this, "$and");
	},
	/* any */
	$any: function () {
		if (!_isObject(this._search.$any)) {
			if (this.debug) {
				console.log('Tried to run any without $any object set');
			}
			return false;
		}

		return this.$base.call(this, "$any", some);
	},
	/* eq */
	$eq: function () {
		if (!_isObject(this._search.$eq)) {
			if (this.debug) {
				console.log('Tried to run eq without $eq object set');
			}
			return false;
		}
		var comparer = function (a, b) {
			if (this.debug) {
				console.log('compare $eq', a, b);
			}
			b = ensureArray(b);
			a = ensureArray(a);
			if (this.debug) {
				console.log('compare $eq', a, b);
			}
			var ret = every(b, function (v) {
				return a.indexOf(v) > -1;
			});

			return ret;
		};
		return this.$base.call(this, "$eq", every, false, comparer);
	},
	/* falsey */
	$falsey: function () {
		if (!_isObject(this._search.$falsey)) {
			if (this.debug) {
				console.log('Tried to run falsey without $falsey object set');
			}
			return false;
		}
		var comparer = function (a, b) {
			b = ensureArray(b);
			var ret = every(b, function (v) {
				if (!!v) {
					return false;
				} else {
					return true;
				}
			});

			return ret;
		};
		return this.$base.call(this, "$falsey", every, false, comparer);
	},
	/* falsy */
	$falsy: this.$falsey,
	/* greater than */
	$gt: function () {
		if (!_isObject(this._search.$gt)) {
			if (this.debug) {
				console.log('Tried to run gt without $gt object set');
			}
			return false;
		}
		var comparer = function (a, b) {
			b = ensureArray(b);
			var ret = every(b, function (v) {
				if (this.debug) {
					console.log('gt ' + Number(a) + ' > ' + Number(v));
				}
				return Number(a) > Number(v);
			});

			return ret;
		};

		return this.$base.call(this, "$gt", every, false, comparer);
	},
	/* greater than or equal*/
	$gte: function () {

		if (!_isObject(this._search.$gte)) {
			if (this.debug) {
				console.log('Tried to run gte without $gte object set');
			}
			return false;
		}
		var comparer = function (a, b) {
			b = ensureArray(b);
			var ret = every(b, function (v) {
				if (this.debug) {
					console.log('gte ' + Number(a) + ' >= ' + Number(v));
				}
				return Number(a) >= Number(v);
			});

			return ret;
		};

		return this.$base.call(this, "$gte", every, false, comparer);
	},
	/* in */
	$in: function () {
		if (!_isObject(this._search.$in)) {
			if (this.debug) {
				console.log('Tried to run in without $in object set');
			}
			return false;
		}
		var comparer = function (a, b) {

			b = ensureArray(b);
			a = ensureArray(a);
			if (this.debug) {
				console.log('are any values in field', a, b);
			}
			var ret = every(b, function (v) {
				return a.indexOf(v) > -1;
			});

			return ret;
		};
		return this.$base.call(this, "$in", every, false, comparer);
	},
	/* less than */
	$lt: function () {
		if (!_isObject(this._search.$lt)) {
			if (this.debug) {
				console.log('Tried to run lt without $lt object set');
			}
			return false;
		}
		var comparer = function (a, b) {
			b = ensureArray(b);
			var ret = every(b, function (v) {
				if (this.debug) {
					console.log('lte ' + Number(a) + ' < ' + Number(v));
				}
				return Number(a) < Number(v);
			});

			return ret;
		};

		return this.$base.call(this, "$lt", every, false, comparer);
	},
	/* less than or equal */
	$lte: function () {
		if (!_isObject(this._search.$lte)) {
			if (this.debug) {
				console.log('Tried to run lte without $lte object set');
			}
			return false;
		}
		var comparer = function (a, b) {
			b = ensureArray(b);
			var ret = every(b, function (v) {
				if (this.debug) {
					console.log('lte ' + Number(a) + ' =< ' + Number(v));
				}
				return Number(a) <= Number(v);
			});

			return ret;
		};

		return this.$base.call(this, "$lte", every, false, comparer);
	},
	/* ne */
	$ne: function () {
		if (!_isObject(this._search.$ne)) {
			if (this.debug) {
				console.log('Tried to run ne without $ne object set');
			}
			return false;
		}
		var comparer = function (a, b) {
			b = ensureArray(b);
			var ret = every(b, function (v) {
				return a !== v;
			});

			return ret;
		};
		return this.$base.call(this, "$ne", every, false, comparer);
	},
	/* not */
	$not: function () {
		if (!_isObject(this._search.$not)) {
			if (this.debug) {
				console.log('Tried to run not without $not object set');
			}
			return false;
		}
		var comparer = function (a, b) {
			b = ensureArray(b);
			var ret = includes(b, a);
			return !ret;
		};
		return this.$base.call(this, "$not", every, false, comparer);
	},
	/* or */
	$or: function () {
		if (!_isObject(this._search.$or)) {
			if (this.debug) {
				console.log('Tried to run or without $or object set');
			}
			return false;
		}

		return this.$base.call(this, "$or", some);
	},
	/* regex */
	$regex: function () {
		if (!_isObject(this._search.$regex)) {
			if (this.debug) {
				console.log('Tried to run regex without $regex object set');
			}
			return false;
		}
		function prepareRegExpString(string) {
			var obj = {};
			var params = string.substr(string.lastIndexOf('/') + 1);
			obj.params = params.search("g") ? params : '';
			obj.regex = string.substring((string.indexOf('/') === 0) ? 1 : 0, string.lastIndexOf('/'));
			if (this.debug) {
				console.log('$regex prepare', obj);
			}
			return obj;
		};
		var comparer = function (a, b) {
			if (isRegExp(b)) {
				return b.test(a);
			} else {
				var regex = prepareRegExpString.call(this, b);
				return new RegExp(regex.regex, regex.params).test(a);
			}
		};
		return this.$base.call(this, "$regex", every, false, comparer);
	},
	/* truthy */
	$truthy: function () {
		if (!_isObject(this._search.$truthy)) {
			if (this.debug) {
				console.log('Tried to run truthy without $truthy object set');
			}
			return false;
		}
		var comparer = function (a, b) {
			b = ensureArray(b);
			var ret = every(b, function (v) {
				return !!v
			});

			return ret;
		};
		return this.$base.call(this, "$truthy", every, false, comparer);
	},


});

function expressionMethods(expressions) {

	/**
	 * add patterns to expresion search
	 * @param  {object} search patterns
	 * return boolean
	 */

	expressions.forEach(function (exp) {
		ExMatch.prototype[exp] = function (pattern) {
			if (!_isObject(pattern)) {
				return false;
			}
			var newExp = {};
			newExp[exp] = pattern;
			this.addSearchParams(newExp);
			return this;
		}

	}.bind(this));

}

function ensureArray(val) {
	return (_isArray(val)) ? val : [val];
}

function ensureArrayOrObject(obj) {
	return (_isArray(obj) || _isObject(obj)) ? obj : [obj];
}
