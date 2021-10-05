var pas = {};

var rtl = {

  version: 20006,

  quiet: false,
  debug_load_units: false,
  debug_rtti: false,

  $res : {},

  debug: function(){
    if (rtl.quiet || !console || !console.log) return;
    console.log(arguments);
  },

  error: function(s){
    rtl.debug('Error: ',s);
    throw s;
  },

  warn: function(s){
    rtl.debug('Warn: ',s);
  },

  checkVersion: function(v){
    if (rtl.version != v) throw "expected rtl version "+v+", but found "+rtl.version;
  },

  hiInt: Math.pow(2,53),

  hasString: function(s){
    return rtl.isString(s) && (s.length>0);
  },

  isArray: function(a) {
    return Array.isArray(a);
  },

  isFunction: function(f){
    return typeof(f)==="function";
  },

  isModule: function(m){
    return rtl.isObject(m) && rtl.hasString(m.$name) && (pas[m.$name]===m);
  },

  isImplementation: function(m){
    return rtl.isObject(m) && rtl.isModule(m.$module) && (m.$module.$impl===m);
  },

  isNumber: function(n){
    return typeof(n)==="number";
  },

  isObject: function(o){
    var s=typeof(o);
    return (typeof(o)==="object") && (o!=null);
  },

  isString: function(s){
    return typeof(s)==="string";
  },

  getNumber: function(n){
    return typeof(n)==="number"?n:NaN;
  },

  getChar: function(c){
    return ((typeof(c)==="string") && (c.length===1)) ? c : "";
  },

  getObject: function(o){
    return ((typeof(o)==="object") || (typeof(o)==='function')) ? o : null;
  },

  isTRecord: function(type){
    return (rtl.isObject(type) && type.hasOwnProperty('$new') && (typeof(type.$new)==='function'));
  },

  isPasClass: function(type){
    return (rtl.isObject(type) && type.hasOwnProperty('$classname') && rtl.isObject(type.$module));
  },

  isPasClassInstance: function(type){
    return (rtl.isObject(type) && rtl.isPasClass(type.$class));
  },

  hexStr: function(n,digits){
    return ("000000000000000"+n.toString(16).toUpperCase()).slice(-digits);
  },

  m_loading: 0,
  m_loading_intf: 1,
  m_intf_loaded: 2,
  m_loading_impl: 3, // loading all used unit
  m_initializing: 4, // running initialization
  m_initialized: 5,

  module: function(module_name, intfuseslist, intfcode, impluseslist){
    if (rtl.debug_load_units) rtl.debug('rtl.module name="'+module_name+'" intfuses='+intfuseslist+' impluses='+impluseslist);
    if (!rtl.hasString(module_name)) rtl.error('invalid module name "'+module_name+'"');
    if (!rtl.isArray(intfuseslist)) rtl.error('invalid interface useslist of "'+module_name+'"');
    if (!rtl.isFunction(intfcode)) rtl.error('invalid interface code of "'+module_name+'"');
    if (!(impluseslist==undefined) && !rtl.isArray(impluseslist)) rtl.error('invalid implementation useslist of "'+module_name+'"');

    if (pas[module_name])
      rtl.error('module "'+module_name+'" is already registered');

    var r = Object.create(rtl.tSectionRTTI);
    var module = r.$module = pas[module_name] = {
      $name: module_name,
      $intfuseslist: intfuseslist,
      $impluseslist: impluseslist,
      $state: rtl.m_loading,
      $intfcode: intfcode,
      $implcode: null,
      $impl: null,
      $rtti: r
    };
    if (impluseslist) module.$impl = {
          $module: module,
          $rtti: r
        };
  },

  exitcode: 0,

  run: function(module_name){
    try {
      if (!rtl.hasString(module_name)) module_name='program';
      if (rtl.debug_load_units) rtl.debug('rtl.run module="'+module_name+'"');
      rtl.initRTTI();
      var module = pas[module_name];
      if (!module) rtl.error('rtl.run module "'+module_name+'" missing');
      rtl.loadintf(module);
      rtl.loadimpl(module);
      if (module_name=='program'){
        if (rtl.debug_load_units) rtl.debug('running $main');
        var r = pas.program.$main();
        if (rtl.isNumber(r)) rtl.exitcode = r;
      }
    } catch(re) {
      if (!rtl.showUncaughtExceptions) {
        throw re
      } else {  
        if (!rtl.handleUncaughtException(re)) {
          rtl.showException(re);
          rtl.exitcode = 216;
        }  
      }
    } 
    return rtl.exitcode;
  },
  
  showException : function (re) {
    var errMsg = rtl.hasString(re.$classname) ? re.$classname : '';
    errMsg +=  ((errMsg) ? ': ' : '') + (re.hasOwnProperty('fMessage') ? re.fMessage : re);
    alert('Uncaught Exception : '+errMsg);
  },

  handleUncaughtException: function (e) {
    if (rtl.onUncaughtException) {
      try {
        rtl.onUncaughtException(e);
        return true;
      } catch (ee) {
        return false; 
      }
    } else {
      return false;
    }
  },

  loadintf: function(module){
    if (module.$state>rtl.m_loading_intf) return; // already finished
    if (rtl.debug_load_units) rtl.debug('loadintf: "'+module.$name+'"');
    if (module.$state===rtl.m_loading_intf)
      rtl.error('unit cycle detected "'+module.$name+'"');
    module.$state=rtl.m_loading_intf;
    // load interfaces of interface useslist
    rtl.loaduseslist(module,module.$intfuseslist,rtl.loadintf);
    // run interface
    if (rtl.debug_load_units) rtl.debug('loadintf: run intf of "'+module.$name+'"');
    module.$intfcode(module.$intfuseslist);
    // success
    module.$state=rtl.m_intf_loaded;
    // Note: units only used in implementations are not yet loaded (not even their interfaces)
  },

  loaduseslist: function(module,useslist,f){
    if (useslist==undefined) return;
    var len = useslist.length;
    for (var i = 0; i<len; i++) {
      var unitname=useslist[i];
      if (rtl.debug_load_units) rtl.debug('loaduseslist of "'+module.$name+'" uses="'+unitname+'"');
      if (pas[unitname]==undefined)
        rtl.error('module "'+module.$name+'" misses "'+unitname+'"');
      f(pas[unitname]);
    }
  },

  loadimpl: function(module){
    if (module.$state>=rtl.m_loading_impl) return; // already processing
    if (module.$state<rtl.m_intf_loaded) rtl.error('loadimpl: interface not loaded of "'+module.$name+'"');
    if (rtl.debug_load_units) rtl.debug('loadimpl: load uses of "'+module.$name+'"');
    module.$state=rtl.m_loading_impl;
    // load interfaces of implementation useslist
    rtl.loaduseslist(module,module.$impluseslist,rtl.loadintf);
    // load implementation of interfaces useslist
    rtl.loaduseslist(module,module.$intfuseslist,rtl.loadimpl);
    // load implementation of implementation useslist
    rtl.loaduseslist(module,module.$impluseslist,rtl.loadimpl);
    // Note: At this point all interfaces used by this unit are loaded. If
    //   there are implementation uses cycles some used units might not yet be
    //   initialized. This is by design.
    // run implementation
    if (rtl.debug_load_units) rtl.debug('loadimpl: run impl of "'+module.$name+'"');
    if (rtl.isFunction(module.$implcode)) module.$implcode(module.$impluseslist);
    // run initialization
    if (rtl.debug_load_units) rtl.debug('loadimpl: run init of "'+module.$name+'"');
    module.$state=rtl.m_initializing;
    if (rtl.isFunction(module.$init)) module.$init();
    // unit initialized
    module.$state=rtl.m_initialized;
  },

  createCallback: function(scope, fn){
    var cb;
    if (typeof(fn)==='string'){
      cb = function(){
        return scope[fn].apply(scope,arguments);
      };
    } else {
      cb = function(){
        return fn.apply(scope,arguments);
      };
    };
    cb.scope = scope;
    cb.fn = fn;
    return cb;
  },

  createSafeCallback: function(scope, fn){
    var cb = function(){
      try{
        if (typeof(fn)==='string'){
          return scope[fn].apply(scope,arguments);
        } else {
          return fn.apply(scope,arguments);
        };
      } catch (err) {
        if (!rtl.handleUncaughtException(err)) throw err;
      }
    };
    cb.scope = scope;
    cb.fn = fn;
    return cb;
  },

  cloneCallback: function(cb){
    return rtl.createCallback(cb.scope,cb.fn);
  },

  eqCallback: function(a,b){
    // can be a function or a function wrapper
    if (a==b){
      return true;
    } else {
      return (a!=null) && (b!=null) && (a.fn) && (a.scope===b.scope) && (a.fn==b.fn);
    }
  },

  initStruct: function(c,parent,name){
    if ((parent.$module) && (parent.$module.$impl===parent)) parent=parent.$module;
    c.$parent = parent;
    if (rtl.isModule(parent)){
      c.$module = parent;
      c.$name = name;
    } else {
      c.$module = parent.$module;
      c.$name = parent.$name+'.'+name;
    };
    return parent;
  },

  initClass: function(c,parent,name,initfn,rttiname){
    parent[name] = c;
    c.$class = c; // Note: o.$class === Object.getPrototypeOf(o)
    c.$classname = rttiname?rttiname:name;
    parent = rtl.initStruct(c,parent,name);
    c.$fullname = parent.$name+'.'+name;
    // rtti
    if (rtl.debug_rtti) rtl.debug('initClass '+c.$fullname);
    var t = c.$module.$rtti.$Class(c.$classname,{ "class": c });
    c.$rtti = t;
    if (rtl.isObject(c.$ancestor)) t.ancestor = c.$ancestor.$rtti;
    if (!t.ancestor) t.ancestor = null;
    // init members
    initfn.call(c);
  },

  createClass: function(parent,name,ancestor,initfn,rttiname){
    // create a normal class,
    // ancestor must be null or a normal class,
    // the root ancestor can be an external class
    var c = null;
    if (ancestor != null){
      c = Object.create(ancestor);
      c.$ancestor = ancestor;
      // Note:
      // if root is an "object" then c.$ancestor === Object.getPrototypeOf(c)
      // if root is a "function" then c.$ancestor === c.__proto__, Object.getPrototypeOf(c) returns the root
    } else {
      c = { $ancestor: null };
      c.$create = function(fn,args){
        if (args == undefined) args = [];
        var o = Object.create(this);
        o.$init();
        try{
          if (typeof(fn)==="string"){
            o[fn].apply(o,args);
          } else {
            fn.apply(o,args);
          };
          o.AfterConstruction();
        } catch($e){
          // do not call BeforeDestruction
          if (o.Destroy) o.Destroy();
          o.$final();
          throw $e;
        }
        return o;
      };
      c.$destroy = function(fnname){
        this.BeforeDestruction();
        if (this[fnname]) this[fnname]();
        this.$final();
      };
    };
    rtl.initClass(c,parent,name,initfn,rttiname);
  },

  createClassExt: function(parent,name,ancestor,newinstancefnname,initfn,rttiname){
    // Create a class using an external ancestor.
    // If newinstancefnname is given, use that function to create the new object.
    // If exist call BeforeDestruction and AfterConstruction.
    var isFunc = rtl.isFunction(ancestor);
    var c = null;
    if (isFunc){
      // create pascal class descendent from JS function
      c = Object.create(ancestor.prototype);
      c.$ancestorfunc = ancestor;
      c.$ancestor = null; // no pascal ancestor
    } else if (ancestor.$func){
      // create pascal class descendent from a pascal class descendent of a JS function
      isFunc = true;
      c = Object.create(ancestor);
      c.$ancestor = ancestor;
    } else {
      c = Object.create(ancestor);
      c.$ancestor = null; // no pascal ancestor
    }
    c.$create = function(fn,args){
      if (args == undefined) args = [];
      var o = null;
      if (newinstancefnname.length>0){
        o = this[newinstancefnname](fn,args);
      } else if(isFunc) {
        o = new this.$func(args);
      } else {
        o = Object.create(c);
      }
      if (o.$init) o.$init();
      try{
        if (typeof(fn)==="string"){
          this[fn].apply(o,args);
        } else {
          fn.apply(o,args);
        };
        if (o.AfterConstruction) o.AfterConstruction();
      } catch($e){
        // do not call BeforeDestruction
        if (o.Destroy) o.Destroy();
        if (o.$final) o.$final();
        throw $e;
      }
      return o;
    };
    c.$destroy = function(fnname){
      if (this.BeforeDestruction) this.BeforeDestruction();
      if (this[fnname]) this[fnname]();
      if (this.$final) this.$final();
    };
    rtl.initClass(c,parent,name,initfn,rttiname);
    if (isFunc){
      function f(){}
      f.prototype = c;
      c.$func = f;
    }
  },

  createHelper: function(parent,name,ancestor,initfn,rttiname){
    // create a helper,
    // ancestor must be null or a helper,
    var c = null;
    if (ancestor != null){
      c = Object.create(ancestor);
      c.$ancestor = ancestor;
      // c.$ancestor === Object.getPrototypeOf(c)
    } else {
      c = { $ancestor: null };
    };
    parent[name] = c;
    c.$class = c; // Note: o.$class === Object.getPrototypeOf(o)
    c.$classname = rttiname?rttiname:name;
    parent = rtl.initStruct(c,parent,name);
    c.$fullname = parent.$name+'.'+name;
    // rtti
    var t = c.$module.$rtti.$Helper(c.$classname,{ "helper": c });
    c.$rtti = t;
    if (rtl.isObject(ancestor)) t.ancestor = ancestor.$rtti;
    if (!t.ancestor) t.ancestor = null;
    // init members
    initfn.call(c);
  },

  tObjectDestroy: "Destroy",

  free: function(obj,name){
    if (obj[name]==null) return null;
    obj[name].$destroy(rtl.tObjectDestroy);
    obj[name]=null;
  },

  freeLoc: function(obj){
    if (obj==null) return null;
    obj.$destroy(rtl.tObjectDestroy);
    return null;
  },

  hideProp: function(o,p,v){
    Object.defineProperty(o,p, {
      enumerable: false,
      configurable: true,
      writable: true
    });
    if(arguments.length>2){ o[p]=v; }
  },

  recNewT: function(parent,name,initfn,full){
    // create new record type
    var t = {};
    if (parent) parent[name] = t;
    var h = rtl.hideProp;
    if (full){
      rtl.initStruct(t,parent,name);
      t.$record = t;
      h(t,'$record');
      h(t,'$name');
      h(t,'$parent');
      h(t,'$module');
      h(t,'$initSpec');
    }
    initfn.call(t);
    if (!t.$new){
      t.$new = function(){ return Object.create(t); };
    }
    t.$clone = function(r){ return t.$new().$assign(r); };
    h(t,'$new');
    h(t,'$clone');
    h(t,'$eq');
    h(t,'$assign');
    return t;
  },

  is: function(instance,type){
    return type.isPrototypeOf(instance) || (instance===type);
  },

  isExt: function(instance,type,mode){
    // mode===1 means instance must be a Pascal class instance
    // mode===2 means instance must be a Pascal class
    // Notes:
    // isPrototypeOf and instanceof return false on equal
    // isPrototypeOf does not work for Date.isPrototypeOf(new Date())
    //   so if isPrototypeOf is false test with instanceof
    // instanceof needs a function on right side
    if (instance == null) return false; // Note: ==null checks for undefined too
    if ((typeof(type) !== 'object') && (typeof(type) !== 'function')) return false;
    if (instance === type){
      if (mode===1) return false;
      if (mode===2) return rtl.isPasClass(instance);
      return true;
    }
    if (type.isPrototypeOf && type.isPrototypeOf(instance)){
      if (mode===1) return rtl.isPasClassInstance(instance);
      if (mode===2) return rtl.isPasClass(instance);
      return true;
    }
    if ((typeof type == 'function') && (instance instanceof type)) return true;
    return false;
  },

  Exception: null,
  EInvalidCast: null,
  EAbstractError: null,
  ERangeError: null,
  EIntOverflow: null,
  EPropWriteOnly: null,

  raiseE: function(typename){
    var t = rtl[typename];
    if (t==null){
      var mod = pas.SysUtils;
      if (!mod) mod = pas.sysutils;
      if (mod){
        t = mod[typename];
        if (!t) t = mod[typename.toLowerCase()];
        if (!t) t = mod['Exception'];
        if (!t) t = mod['exception'];
      }
    }
    if (t){
      if (t.Create){
        throw t.$create("Create");
      } else if (t.create){
        throw t.$create("create");
      }
    }
    if (typename === "EInvalidCast") throw "invalid type cast";
    if (typename === "EAbstractError") throw "Abstract method called";
    if (typename === "ERangeError") throw "range error";
    throw typename;
  },

  as: function(instance,type){
    if((instance === null) || rtl.is(instance,type)) return instance;
    rtl.raiseE("EInvalidCast");
  },

  asExt: function(instance,type,mode){
    if((instance === null) || rtl.isExt(instance,type,mode)) return instance;
    rtl.raiseE("EInvalidCast");
  },

  createInterface: function(module, name, guid, fnnames, ancestor, initfn){
    //console.log('createInterface name="'+name+'" guid="'+guid+'" names='+fnnames);
    var i = ancestor?Object.create(ancestor):{};
    module[name] = i;
    i.$module = module;
    i.$name = name;
    i.$fullname = module.$name+'.'+name;
    i.$guid = guid;
    i.$guidr = null;
    i.$names = fnnames?fnnames:[];
    if (rtl.isFunction(initfn)){
      // rtti
      if (rtl.debug_rtti) rtl.debug('createInterface '+i.$fullname);
      var t = i.$module.$rtti.$Interface(name,{ "interface": i, module: module });
      i.$rtti = t;
      if (ancestor) t.ancestor = ancestor.$rtti;
      if (!t.ancestor) t.ancestor = null;
      initfn.call(i);
    }
    return i;
  },

  strToGUIDR: function(s,g){
    var p = 0;
    function n(l){
      var h = s.substr(p,l);
      p+=l;
      return parseInt(h,16);
    }
    p+=1; // skip {
    g.D1 = n(8);
    p+=1; // skip -
    g.D2 = n(4);
    p+=1; // skip -
    g.D3 = n(4);
    p+=1; // skip -
    if (!g.D4) g.D4=[];
    g.D4[0] = n(2);
    g.D4[1] = n(2);
    p+=1; // skip -
    for(var i=2; i<8; i++) g.D4[i] = n(2);
    return g;
  },

  guidrToStr: function(g){
    if (g.$intf) return g.$intf.$guid;
    var h = rtl.hexStr;
    var s='{'+h(g.D1,8)+'-'+h(g.D2,4)+'-'+h(g.D3,4)+'-'+h(g.D4[0],2)+h(g.D4[1],2)+'-';
    for (var i=2; i<8; i++) s+=h(g.D4[i],2);
    s+='}';
    return s;
  },

  createTGUID: function(guid){
    var TGuid = (pas.System)?pas.System.TGuid:pas.system.tguid;
    var g = rtl.strToGUIDR(guid,TGuid.$new());
    return g;
  },

  getIntfGUIDR: function(intfTypeOrVar){
    if (!intfTypeOrVar) return null;
    if (!intfTypeOrVar.$guidr){
      var g = rtl.createTGUID(intfTypeOrVar.$guid);
      if (!intfTypeOrVar.hasOwnProperty('$guid')) intfTypeOrVar = Object.getPrototypeOf(intfTypeOrVar);
      g.$intf = intfTypeOrVar;
      intfTypeOrVar.$guidr = g;
    }
    return intfTypeOrVar.$guidr;
  },

  addIntf: function (aclass, intf, map){
    function jmp(fn){
      if (typeof(fn)==="function"){
        return function(){ return fn.apply(this.$o,arguments); };
      } else {
        return function(){ rtl.raiseE('EAbstractError'); };
      }
    }
    if(!map) map = {};
    var t = intf;
    var item = Object.create(t);
    if (!aclass.hasOwnProperty('$intfmaps')) aclass.$intfmaps = {};
    aclass.$intfmaps[intf.$guid] = item;
    do{
      var names = t.$names;
      if (!names) break;
      for (var i=0; i<names.length; i++){
        var intfname = names[i];
        var fnname = map[intfname];
        if (!fnname) fnname = intfname;
        //console.log('addIntf: intftype='+t.$name+' index='+i+' intfname="'+intfname+'" fnname="'+fnname+'" old='+typeof(item[intfname]));
        item[intfname] = jmp(aclass[fnname]);
      }
      t = Object.getPrototypeOf(t);
    }while(t!=null);
  },

  getIntfG: function (obj, guid, query){
    if (!obj) return null;
    //console.log('getIntfG: obj='+obj.$classname+' guid='+guid+' query='+query);
    // search
    var maps = obj.$intfmaps;
    if (!maps) return null;
    var item = maps[guid];
    if (!item) return null;
    // check delegation
    //console.log('getIntfG: obj='+obj.$classname+' guid='+guid+' query='+query+' item='+typeof(item));
    if (typeof item === 'function') return item.call(obj); // delegate. Note: COM contains _AddRef
    // check cache
    var intf = null;
    if (obj.$interfaces){
      intf = obj.$interfaces[guid];
      //console.log('getIntfG: obj='+obj.$classname+' guid='+guid+' cache='+typeof(intf));
    }
    if (!intf){ // intf can be undefined!
      intf = Object.create(item);
      intf.$o = obj;
      if (!obj.$interfaces) obj.$interfaces = {};
      obj.$interfaces[guid] = intf;
    }
    if (typeof(query)==='object'){
      // called by queryIntfT
      var o = null;
      if (intf.QueryInterface(rtl.getIntfGUIDR(query),
          {get:function(){ return o; }, set:function(v){ o=v; }}) === 0){
        return o;
      } else {
        return null;
      }
    } else if(query===2){
      // called by TObject.GetInterfaceByStr
      if (intf.$kind === 'com') intf._AddRef();
    }
    return intf;
  },

  getIntfT: function(obj,intftype){
    return rtl.getIntfG(obj,intftype.$guid);
  },

  queryIntfT: function(obj,intftype){
    return rtl.getIntfG(obj,intftype.$guid,intftype);
  },

  queryIntfIsT: function(obj,intftype){
    var i = rtl.getIntfG(obj,intftype.$guid);
    if (!i) return false;
    if (i.$kind === 'com') i._Release();
    return true;
  },

  asIntfT: function (obj,intftype){
    var i = rtl.getIntfG(obj,intftype.$guid);
    if (i!==null) return i;
    rtl.raiseEInvalidCast();
  },

  intfIsIntfT: function(intf,intftype){
    return (intf!==null) && rtl.queryIntfIsT(intf.$o,intftype);
  },

  intfAsIntfT: function (intf,intftype){
    if (!intf) return null;
    var i = rtl.getIntfG(intf.$o,intftype.$guid);
    if (i) return i;
    rtl.raiseEInvalidCast();
  },

  intfIsClass: function(intf,classtype){
    return (intf!=null) && (rtl.is(intf.$o,classtype));
  },

  intfAsClass: function(intf,classtype){
    if (intf==null) return null;
    return rtl.as(intf.$o,classtype);
  },

  intfToClass: function(intf,classtype){
    if ((intf!==null) && rtl.is(intf.$o,classtype)) return intf.$o;
    return null;
  },

  // interface reference counting
  intfRefs: { // base object for temporary interface variables
    ref: function(id,intf){
      // called for temporary interface references needing delayed release
      var old = this[id];
      //console.log('rtl.intfRefs.ref: id='+id+' old="'+(old?old.$name:'null')+'" intf="'+(intf?intf.$name:'null')+' $o='+(intf?intf.$o:'null'));
      if (old){
        // called again, e.g. in a loop
        delete this[id];
        old._Release(); // may fail
      }
      if(intf) {
        this[id]=intf;
      }
      return intf;
    },
    free: function(){
      //console.log('rtl.intfRefs.free...');
      for (var id in this){
        if (this.hasOwnProperty(id)){
          var intf = this[id];
          if (intf){
            //console.log('rtl.intfRefs.free: id='+id+' '+intf.$name+' $o='+intf.$o.$classname);
            intf._Release();
          }
        }
      }
    }
  },

  createIntfRefs: function(){
    //console.log('rtl.createIntfRefs');
    return Object.create(rtl.intfRefs);
  },

  setIntfP: function(path,name,value,skipAddRef){
    var old = path[name];
    //console.log('rtl.setIntfP path='+path+' name='+name+' old="'+(old?old.$name:'null')+'" value="'+(value?value.$name:'null')+'"');
    if (old === value) return;
    if (old !== null){
      path[name]=null;
      old._Release();
    }
    if (value !== null){
      if (!skipAddRef) value._AddRef();
      path[name]=value;
    }
  },

  setIntfL: function(old,value,skipAddRef){
    //console.log('rtl.setIntfL old="'+(old?old.$name:'null')+'" value="'+(value?value.$name:'null')+'"');
    if (old !== value){
      if (value!==null){
        if (!skipAddRef) value._AddRef();
      }
      if (old!==null){
        old._Release();  // Release after AddRef, to avoid double Release if Release creates an exception
      }
    } else if (skipAddRef){
      if (old!==null){
        old._Release();  // value has an AddRef
      }
    }
    return value;
  },

  _AddRef: function(intf){
    //if (intf) console.log('rtl._AddRef intf="'+(intf?intf.$name:'null')+'"');
    if (intf) intf._AddRef();
    return intf;
  },

  _Release: function(intf){
    //if (intf) console.log('rtl._Release intf="'+(intf?intf.$name:'null')+'"');
    if (intf) intf._Release();
    return intf;
  },

  trunc: function(a){
    return a<0 ? Math.ceil(a) : Math.floor(a);
  },

  checkMethodCall: function(obj,type){
    if (rtl.isObject(obj) && rtl.is(obj,type)) return;
    rtl.raiseE("EInvalidCast");
  },

  oc: function(i){
    // overflow check integer
    if ((Math.floor(i)===i) && (i>=-0x1fffffffffffff) && (i<=0x1fffffffffffff)) return i;
    rtl.raiseE('EIntOverflow');
  },

  rc: function(i,minval,maxval){
    // range check integer
    if ((Math.floor(i)===i) && (i>=minval) && (i<=maxval)) return i;
    rtl.raiseE('ERangeError');
  },

  rcc: function(c,minval,maxval){
    // range check char
    if ((typeof(c)==='string') && (c.length===1)){
      var i = c.charCodeAt(0);
      if ((i>=minval) && (i<=maxval)) return c;
    }
    rtl.raiseE('ERangeError');
  },

  rcSetCharAt: function(s,index,c){
    // range check setCharAt
    if ((typeof(s)!=='string') || (index<0) || (index>=s.length)) rtl.raiseE('ERangeError');
    return rtl.setCharAt(s,index,c);
  },

  rcCharAt: function(s,index){
    // range check charAt
    if ((typeof(s)!=='string') || (index<0) || (index>=s.length)) rtl.raiseE('ERangeError');
    return s.charAt(index);
  },

  rcArrR: function(arr,index){
    // range check read array
    if (Array.isArray(arr) && (typeof(index)==='number') && (index>=0) && (index<arr.length)){
      if (arguments.length>2){
        // arr,index1,index2,...
        arr=arr[index];
        for (var i=2; i<arguments.length; i++) arr=rtl.rcArrR(arr,arguments[i]);
        return arr;
      }
      return arr[index];
    }
    rtl.raiseE('ERangeError');
  },

  rcArrW: function(arr,index,value){
    // range check write array
    // arr,index1,index2,...,value
    for (var i=3; i<arguments.length; i++){
      arr=rtl.rcArrR(arr,index);
      index=arguments[i-1];
      value=arguments[i];
    }
    if (Array.isArray(arr) && (typeof(index)==='number') && (index>=0) && (index<arr.length)){
      return arr[index]=value;
    }
    rtl.raiseE('ERangeError');
  },

  length: function(arr){
    return (arr == null) ? 0 : arr.length;
  },

  arrayRef: function(a){
    if (a!=null) rtl.hideProp(a,'$pas2jsrefcnt',1);
    return a;
  },

  arraySetLength: function(arr,defaultvalue,newlength){
    var stack = [];
    var s = 9999;
    for (var i=2; i<arguments.length; i++){
      var j = arguments[i];
      if (j==='s'){ s = i-2; }
      else {
        stack.push({ dim:j+0, a:null, i:0, src:null });
      }
    }
    var dimmax = stack.length-1;
    var depth = 0;
    var lastlen = 0;
    var item = null;
    var a = null;
    var src = arr;
    var srclen = 0, oldlen = 0;
    do{
      if (depth>0){
        item=stack[depth-1];
        src = (item.src && item.src.length>item.i)?item.src[item.i]:null;
      }
      if (!src){
        a = [];
        srclen = 0;
        oldlen = 0;
      } else if (src.$pas2jsrefcnt>0 || depth>=s){
        a = [];
        srclen = src.length;
        oldlen = srclen;
      } else {
        a = src;
        srclen = 0;
        oldlen = a.length;
      }
      lastlen = stack[depth].dim;
      a.length = lastlen;
      if (depth>0){
        item.a[item.i]=a;
        item.i++;
        if ((lastlen===0) && (item.i<item.a.length)) continue;
      }
      if (lastlen>0){
        if (depth<dimmax){
          item = stack[depth];
          item.a = a;
          item.i = 0;
          item.src = src;
          depth++;
          continue;
        } else {
          if (srclen>lastlen) srclen=lastlen;
          if (rtl.isArray(defaultvalue)){
            // array of dyn array
            for (var i=0; i<srclen; i++) a[i]=src[i];
            for (var i=oldlen; i<lastlen; i++) a[i]=[];
          } else if (rtl.isObject(defaultvalue)) {
            if (rtl.isTRecord(defaultvalue)){
              // array of record
              for (var i=0; i<srclen; i++) a[i]=defaultvalue.$clone(src[i]);
              for (var i=oldlen; i<lastlen; i++) a[i]=defaultvalue.$new();
            } else {
              // array of set
              for (var i=0; i<srclen; i++) a[i]=rtl.refSet(src[i]);
              for (var i=oldlen; i<lastlen; i++) a[i]={};
            }
          } else {
            for (var i=0; i<srclen; i++) a[i]=src[i];
            for (var i=oldlen; i<lastlen; i++) a[i]=defaultvalue;
          }
        }
      }
      // backtrack
      while ((depth>0) && (stack[depth-1].i>=stack[depth-1].dim)){
        depth--;
      };
      if (depth===0){
        if (dimmax===0) return a;
        return stack[0].a;
      }
    }while (true);
  },

  arrayEq: function(a,b){
    if (a===null) return b===null;
    if (b===null) return false;
    if (a.length!==b.length) return false;
    for (var i=0; i<a.length; i++) if (a[i]!==b[i]) return false;
    return true;
  },

  arrayClone: function(type,src,srcpos,endpos,dst,dstpos){
    // type: 0 for references, "refset" for calling refSet(), a function for new type()
    // src must not be null
    // This function does not range check.
    if(type === 'refSet') {
      for (; srcpos<endpos; srcpos++) dst[dstpos++] = rtl.refSet(src[srcpos]); // ref set
    } else if (rtl.isTRecord(type)){
      for (; srcpos<endpos; srcpos++) dst[dstpos++] = type.$clone(src[srcpos]); // clone record
    }  else {
      for (; srcpos<endpos; srcpos++) dst[dstpos++] = src[srcpos]; // reference
    };
  },

  arrayConcat: function(type){
    // type: see rtl.arrayClone
    var a = [];
    var l = 0;
    for (var i=1; i<arguments.length; i++){
      var src = arguments[i];
      if (src !== null) l+=src.length;
    };
    a.length = l;
    l=0;
    for (var i=1; i<arguments.length; i++){
      var src = arguments[i];
      if (src === null) continue;
      rtl.arrayClone(type,src,0,src.length,a,l);
      l+=src.length;
    };
    return a;
  },

  arrayConcatN: function(){
    var a = null;
    for (var i=0; i<arguments.length; i++){
      var src = arguments[i];
      if (src === null) continue;
      if (a===null){
        a=rtl.arrayRef(src); // Note: concat(a) does not clone
      } else {
        a=a.concat(src);
      }
    };
    return a;
  },

  arrayCopy: function(type, srcarray, index, count){
    // type: see rtl.arrayClone
    // if count is missing, use srcarray.length
    if (srcarray === null) return [];
    if (index < 0) index = 0;
    if (count === undefined) count=srcarray.length;
    var end = index+count;
    if (end>srcarray.length) end = srcarray.length;
    if (index>=end) return [];
    if (type===0){
      return srcarray.slice(index,end);
    } else {
      var a = [];
      a.length = end-index;
      rtl.arrayClone(type,srcarray,index,end,a,0);
      return a;
    }
  },

  arrayInsert: function(item, arr, index){
    if (arr){
      arr.splice(index,0,item);
      return arr;
    } else {
      return [item];
    }
  },

  setCharAt: function(s,index,c){
    return s.substr(0,index)+c+s.substr(index+1);
  },

  getResStr: function(mod,name){
    var rs = mod.$resourcestrings[name];
    return rs.current?rs.current:rs.org;
  },

  createSet: function(){
    var s = {};
    for (var i=0; i<arguments.length; i++){
      if (arguments[i]!=null){
        s[arguments[i]]=true;
      } else {
        var first=arguments[i+=1];
        var last=arguments[i+=1];
        for(var j=first; j<=last; j++) s[j]=true;
      }
    }
    return s;
  },

  cloneSet: function(s){
    var r = {};
    for (var key in s) r[key]=true;
    return r;
  },

  refSet: function(s){
    rtl.hideProp(s,'$shared',true);
    return s;
  },

  includeSet: function(s,enumvalue){
    if (s.$shared) s = rtl.cloneSet(s);
    s[enumvalue] = true;
    return s;
  },

  excludeSet: function(s,enumvalue){
    if (s.$shared) s = rtl.cloneSet(s);
    delete s[enumvalue];
    return s;
  },

  diffSet: function(s,t){
    var r = {};
    for (var key in s) if (!t[key]) r[key]=true;
    return r;
  },

  unionSet: function(s,t){
    var r = {};
    for (var key in s) r[key]=true;
    for (var key in t) r[key]=true;
    return r;
  },

  intersectSet: function(s,t){
    var r = {};
    for (var key in s) if (t[key]) r[key]=true;
    return r;
  },

  symDiffSet: function(s,t){
    var r = {};
    for (var key in s) if (!t[key]) r[key]=true;
    for (var key in t) if (!s[key]) r[key]=true;
    return r;
  },

  eqSet: function(s,t){
    for (var key in s) if (!t[key]) return false;
    for (var key in t) if (!s[key]) return false;
    return true;
  },

  neSet: function(s,t){
    return !rtl.eqSet(s,t);
  },

  leSet: function(s,t){
    for (var key in s) if (!t[key]) return false;
    return true;
  },

  geSet: function(s,t){
    for (var key in t) if (!s[key]) return false;
    return true;
  },

  strSetLength: function(s,newlen){
    var oldlen = s.length;
    if (oldlen > newlen){
      return s.substring(0,newlen);
    } else if (s.repeat){
      // Note: repeat needs ECMAScript6!
      return s+' '.repeat(newlen-oldlen);
    } else {
       while (oldlen<newlen){
         s+=' ';
         oldlen++;
       };
       return s;
    }
  },

  spaceLeft: function(s,width){
    var l=s.length;
    if (l>=width) return s;
    if (s.repeat){
      // Note: repeat needs ECMAScript6!
      return ' '.repeat(width-l) + s;
    } else {
      while (l<width){
        s=' '+s;
        l++;
      };
      return s;
    };
  },

  floatToStr: function(d,w,p){
    // input 1-3 arguments: double, width, precision
    if (arguments.length>2){
      return rtl.spaceLeft(d.toFixed(p),w);
    } else {
	  // exponent width
	  var pad = "";
	  var ad = Math.abs(d);
	  if (ad<1.0e+10) {
		pad='00';
	  } else if (ad<1.0e+100) {
		pad='0';
      }  	
	  if (arguments.length<2) {
	    w=9;		
      } else if (w<9) {
		w=9;
      }		  
      var p = w-8;
      var s=(d>0 ? " " : "" ) + d.toExponential(p);
      s=s.replace(/e(.)/,'E$1'+pad);
      return rtl.spaceLeft(s,w);
    }
  },

  valEnum: function(s, enumType, setCodeFn){
    s = s.toLowerCase();
    for (var key in enumType){
      if((typeof(key)==='string') && (key.toLowerCase()===s)){
        setCodeFn(0);
        return enumType[key];
      }
    }
    setCodeFn(1);
    return 0;
  },

  lw: function(l){
    // fix longword bitwise operation
    return l<0?l+0x100000000:l;
  },

  and: function(a,b){
    var hi = 0x80000000;
    var low = 0x7fffffff;
    var h = (a / hi) & (b / hi);
    var l = (a & low) & (b & low);
    return h*hi + l;
  },

  or: function(a,b){
    var hi = 0x80000000;
    var low = 0x7fffffff;
    var h = (a / hi) | (b / hi);
    var l = (a & low) | (b & low);
    return h*hi + l;
  },

  xor: function(a,b){
    var hi = 0x80000000;
    var low = 0x7fffffff;
    var h = (a / hi) ^ (b / hi);
    var l = (a & low) ^ (b & low);
    return h*hi + l;
  },

  shr: function(a,b){
    if (a<0) a += rtl.hiInt;
    if (a<0x80000000) return a >> b;
    if (b<=0) return a;
    if (b>54) return 0;
    return Math.floor(a / Math.pow(2,b));
  },

  shl: function(a,b){
    if (a<0) a += rtl.hiInt;
    if (b<=0) return a;
    if (b>54) return 0;
    var r = a * Math.pow(2,b);
    if (r <= rtl.hiInt) return r;
    return r % rtl.hiInt;
  },

  initRTTI: function(){
    if (rtl.debug_rtti) rtl.debug('initRTTI');

    // base types
    rtl.tTypeInfo = { name: "tTypeInfo" };
    function newBaseTI(name,kind,ancestor){
      if (!ancestor) ancestor = rtl.tTypeInfo;
      if (rtl.debug_rtti) rtl.debug('initRTTI.newBaseTI "'+name+'" '+kind+' ("'+ancestor.name+'")');
      var t = Object.create(ancestor);
      t.name = name;
      t.kind = kind;
      rtl[name] = t;
      return t;
    };
    function newBaseInt(name,minvalue,maxvalue,ordtype){
      var t = newBaseTI(name,1 /* tkInteger */,rtl.tTypeInfoInteger);
      t.minvalue = minvalue;
      t.maxvalue = maxvalue;
      t.ordtype = ordtype;
      return t;
    };
    newBaseTI("tTypeInfoInteger",1 /* tkInteger */);
    newBaseInt("shortint",-0x80,0x7f,0);
    newBaseInt("byte",0,0xff,1);
    newBaseInt("smallint",-0x8000,0x7fff,2);
    newBaseInt("word",0,0xffff,3);
    newBaseInt("longint",-0x80000000,0x7fffffff,4);
    newBaseInt("longword",0,0xffffffff,5);
    newBaseInt("nativeint",-0x10000000000000,0xfffffffffffff,6);
    newBaseInt("nativeuint",0,0xfffffffffffff,7);
    newBaseTI("char",2 /* tkChar */);
    newBaseTI("string",3 /* tkString */);
    newBaseTI("tTypeInfoEnum",4 /* tkEnumeration */,rtl.tTypeInfoInteger);
    newBaseTI("tTypeInfoSet",5 /* tkSet */);
    newBaseTI("double",6 /* tkDouble */);
    newBaseTI("boolean",7 /* tkBool */);
    newBaseTI("tTypeInfoProcVar",8 /* tkProcVar */);
    newBaseTI("tTypeInfoMethodVar",9 /* tkMethod */,rtl.tTypeInfoProcVar);
    newBaseTI("tTypeInfoArray",10 /* tkArray */);
    newBaseTI("tTypeInfoDynArray",11 /* tkDynArray */);
    newBaseTI("tTypeInfoPointer",15 /* tkPointer */);
    var t = newBaseTI("pointer",15 /* tkPointer */,rtl.tTypeInfoPointer);
    t.reftype = null;
    newBaseTI("jsvalue",16 /* tkJSValue */);
    newBaseTI("tTypeInfoRefToProcVar",17 /* tkRefToProcVar */,rtl.tTypeInfoProcVar);

    // member kinds
    rtl.tTypeMember = {};
    function newMember(name,kind){
      var m = Object.create(rtl.tTypeMember);
      m.name = name;
      m.kind = kind;
      rtl[name] = m;
    };
    newMember("tTypeMemberField",1); // tmkField
    newMember("tTypeMemberMethod",2); // tmkMethod
    newMember("tTypeMemberProperty",3); // tmkProperty

    // base object for storing members: a simple object
    rtl.tTypeMembers = {};

    // tTypeInfoStruct - base object for tTypeInfoClass, tTypeInfoRecord, tTypeInfoInterface
    var tis = newBaseTI("tTypeInfoStruct",0);
    tis.$addMember = function(name,ancestor,options){
      if (rtl.debug_rtti){
        if (!rtl.hasString(name) || (name.charAt()==='$')) throw 'invalid member "'+name+'", this="'+this.name+'"';
        if (!rtl.is(ancestor,rtl.tTypeMember)) throw 'invalid ancestor "'+ancestor+':'+ancestor.name+'", "'+this.name+'.'+name+'"';
        if ((options!=undefined) && (typeof(options)!='object')) throw 'invalid options "'+options+'", "'+this.name+'.'+name+'"';
      };
      var t = Object.create(ancestor);
      t.name = name;
      this.members[name] = t;
      this.names.push(name);
      if (rtl.isObject(options)){
        for (var key in options) if (options.hasOwnProperty(key)) t[key] = options[key];
      };
      return t;
    };
    tis.addField = function(name,type,options){
      var t = this.$addMember(name,rtl.tTypeMemberField,options);
      if (rtl.debug_rtti){
        if (!rtl.is(type,rtl.tTypeInfo)) throw 'invalid type "'+type+'", "'+this.name+'.'+name+'"';
      };
      t.typeinfo = type;
      this.fields.push(name);
      return t;
    };
    tis.addFields = function(){
      var i=0;
      while(i<arguments.length){
        var name = arguments[i++];
        var type = arguments[i++];
        if ((i<arguments.length) && (typeof(arguments[i])==='object')){
          this.addField(name,type,arguments[i++]);
        } else {
          this.addField(name,type);
        };
      };
    };
    tis.addMethod = function(name,methodkind,params,result,options){
      var t = this.$addMember(name,rtl.tTypeMemberMethod,options);
      t.methodkind = methodkind;
      t.procsig = rtl.newTIProcSig(params);
      t.procsig.resulttype = result?result:null;
      this.methods.push(name);
      return t;
    };
    tis.addProperty = function(name,flags,result,getter,setter,options){
      var t = this.$addMember(name,rtl.tTypeMemberProperty,options);
      t.flags = flags;
      t.typeinfo = result;
      t.getter = getter;
      t.setter = setter;
      // Note: in options: params, stored, defaultvalue
      if (rtl.isArray(t.params)) t.params = rtl.newTIParams(t.params);
      this.properties.push(name);
      if (!rtl.isString(t.stored)) t.stored = "";
      return t;
    };
    tis.getField = function(index){
      return this.members[this.fields[index]];
    };
    tis.getMethod = function(index){
      return this.members[this.methods[index]];
    };
    tis.getProperty = function(index){
      return this.members[this.properties[index]];
    };

    newBaseTI("tTypeInfoRecord",12 /* tkRecord */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoClass",13 /* tkClass */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoClassRef",14 /* tkClassRef */);
    newBaseTI("tTypeInfoInterface",18 /* tkInterface */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoHelper",19 /* tkHelper */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoExtClass",20 /* tkExtClass */,rtl.tTypeInfoClass);
  },

  tSectionRTTI: {
    $module: null,
    $inherited: function(name,ancestor,o){
      if (rtl.debug_rtti){
        rtl.debug('tSectionRTTI.newTI "'+(this.$module?this.$module.$name:"(no module)")
          +'"."'+name+'" ('+ancestor.name+') '+(o?'init':'forward'));
      };
      var t = this[name];
      if (t){
        if (!t.$forward) throw 'duplicate type "'+name+'"';
        if (!ancestor.isPrototypeOf(t)) throw 'typeinfo ancestor mismatch "'+name+'" ancestor="'+ancestor.name+'" t.name="'+t.name+'"';
      } else {
        t = Object.create(ancestor);
        t.name = name;
        t.$module = this.$module;
        this[name] = t;
      }
      if (o){
        delete t.$forward;
        for (var key in o) if (o.hasOwnProperty(key)) t[key]=o[key];
      } else {
        t.$forward = true;
      }
      return t;
    },
    $Scope: function(name,ancestor,o){
      var t=this.$inherited(name,ancestor,o);
      t.members = {};
      t.names = [];
      t.fields = [];
      t.methods = [];
      t.properties = [];
      return t;
    },
    $TI: function(name,kind,o){ var t=this.$inherited(name,rtl.tTypeInfo,o); t.kind = kind; return t; },
    $Int: function(name,o){ return this.$inherited(name,rtl.tTypeInfoInteger,o); },
    $Enum: function(name,o){ return this.$inherited(name,rtl.tTypeInfoEnum,o); },
    $Set: function(name,o){ return this.$inherited(name,rtl.tTypeInfoSet,o); },
    $StaticArray: function(name,o){ return this.$inherited(name,rtl.tTypeInfoArray,o); },
    $DynArray: function(name,o){ return this.$inherited(name,rtl.tTypeInfoDynArray,o); },
    $ProcVar: function(name,o){ return this.$inherited(name,rtl.tTypeInfoProcVar,o); },
    $RefToProcVar: function(name,o){ return this.$inherited(name,rtl.tTypeInfoRefToProcVar,o); },
    $MethodVar: function(name,o){ return this.$inherited(name,rtl.tTypeInfoMethodVar,o); },
    $Record: function(name,o){ return this.$Scope(name,rtl.tTypeInfoRecord,o); },
    $Class: function(name,o){ return this.$Scope(name,rtl.tTypeInfoClass,o); },
    $ClassRef: function(name,o){ return this.$inherited(name,rtl.tTypeInfoClassRef,o); },
    $Pointer: function(name,o){ return this.$inherited(name,rtl.tTypeInfoPointer,o); },
    $Interface: function(name,o){ return this.$Scope(name,rtl.tTypeInfoInterface,o); },
    $Helper: function(name,o){ return this.$Scope(name,rtl.tTypeInfoHelper,o); },
    $ExtClass: function(name,o){ return this.$Scope(name,rtl.tTypeInfoExtClass,o); }
  },

  newTIParam: function(param){
    // param is an array, 0=name, 1=type, 2=optional flags
    var t = {
      name: param[0],
      typeinfo: param[1],
      flags: (rtl.isNumber(param[2]) ? param[2] : 0)
    };
    return t;
  },

  newTIParams: function(list){
    // list: optional array of [paramname,typeinfo,optional flags]
    var params = [];
    if (rtl.isArray(list)){
      for (var i=0; i<list.length; i++) params.push(rtl.newTIParam(list[i]));
    };
    return params;
  },

  newTIProcSig: function(params,result,flags){
    var s = {
      params: rtl.newTIParams(params),
      resulttype: result,
      flags: flags
    };
    return s;
  },

  addResource: function(aRes){
    rtl.$res[aRes.name]=aRes;
  },

  getResource: function(aName){
    var res = rtl.$res[aName];
    if (res !== undefined) {
      return res;
    } else {
      return null;
    }
  },

  getResourceList: function(){
    return Object.keys(rtl.$res);
  }
}

rtl.module("System",[],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.createClass(this,"TObject",null,function () {
    this.$init = function () {
    };
    this.$final = function () {
    };
    this.AfterConstruction = function () {
    };
    this.BeforeDestruction = function () {
    };
  });
  this.Random = function (Range) {
    return Math.floor(Math.random()*Range);
  };
  this.Trunc = function (A) {
    if (!Math.trunc) {
      Math.trunc = function(v) {
        v = +v;
        if (!isFinite(v)) return v;
        return (v - v % 1) || (v < 0 ? -0 : v === 0 ? v : 0);
      };
    }
    $mod.Trunc = Math.trunc;
    return Math.trunc(A);
  };
  this.Copy = function (S, Index, Size) {
    if (Index<1) Index = 1;
    return (Size>0) ? S.substring(Index-1,Index+Size-1) : "";
  };
  this.Pos = function (Search, InString) {
    return InString.indexOf(Search)+1;
  };
  this.Writeln = function () {
    var i = 0;
    var l = 0;
    var s = "";
    l = arguments.length - 1;
    if ($impl.WriteCallBack != null) {
      for (var $l = 0, $end = l; $l <= $end; $l++) {
        i = $l;
        $impl.WriteCallBack(arguments[i],i === l);
      };
    } else {
      s = $impl.WriteBuf;
      for (var $l1 = 0, $end1 = l; $l1 <= $end1; $l1++) {
        i = $l1;
        s = s + ("" + arguments[i]);
      };
      console.log(s);
      $impl.WriteBuf = "";
    };
  };
  $mod.$implcode = function () {
    $impl.WriteBuf = "";
    $impl.WriteCallBack = null;
  };
  $mod.$init = function () {
    rtl.exitcode = 0;
  };
},[]);
rtl.module("JS",["System"],function () {
  "use strict";
  var $mod = this;
  this.isDefined = function (v) {
    return !(v == undefined);
  };
});
rtl.module("Web",["System","JS"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass(this,"TJSKeyNames",pas.System.TObject,function () {
    this.Enter = "Enter";
    this.ArrowDown = "ArrowDown";
    this.ArrowLeft = "ArrowLeft";
    this.ArrowRight = "ArrowRight";
    this.ArrowUp = "ArrowUp";
  });
});
rtl.module("SysUtils",["System","JS"],function () {
  "use strict";
  var $mod = this;
  this.LowerCase = function (s) {
    return s.toLowerCase();
  };
  this.SameText = function (s1, s2) {
    return s1.toLowerCase() == s2.toLowerCase();
  };
  this.IntToStr = function (Value) {
    var Result = "";
    Result = "" + Value;
    return Result;
  };
});
rtl.module("p2jsres",["System"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.TResourceSource = {"0": "rsJS", rsJS: 0, "1": "rsHTML", rsHTML: 1};
  rtl.recNewT(this,"TResourceInfo",function () {
    this.name = "";
    this.encoding = "";
    this.resourceunit = "";
    this.format = "";
    this.data = "";
    this.$eq = function (b) {
      return (this.name === b.name) && (this.encoding === b.encoding) && (this.resourceunit === b.resourceunit) && (this.format === b.format) && (this.data === b.data);
    };
    this.$assign = function (s) {
      this.name = s.name;
      this.encoding = s.encoding;
      this.resourceunit = s.resourceunit;
      this.format = s.format;
      this.data = s.data;
      return this;
    };
  });
  this.SetResourceSource = function (aSource) {
    var Result = 0;
    Result = $impl.gMode;
    $impl.gMode = aSource;
    return Result;
  };
  this.GetResourceInfo = function (aName, aInfo) {
    var Result = false;
    Result = $mod.GetResourceInfo$1($impl.gMode,aName,aInfo);
    return Result;
  };
  this.GetResourceInfo$1 = function (aSource, aName, aInfo) {
    var Result = false;
    var $tmp = aSource;
    if ($tmp === $mod.TResourceSource.rsJS) {
      Result = $impl.GetRTLResourceInfo(aName,aInfo)}
     else if ($tmp === $mod.TResourceSource.rsHTML) Result = $impl.GetHTMLResourceInfo(aName,aInfo);
    return Result;
  };
  $mod.$implcode = function () {
    $impl.gMode = 0;
    $impl.GetRTLResourceInfo = function (aName, aInfo) {
      var Result = false;
      var RTLInfo = null;
      RTLInfo = rtl.getResource(pas.SysUtils.LowerCase(aName));
      Result = RTLInfo != null;
      if (Result) {
        aInfo.name = RTLInfo.name;
        aInfo.encoding = RTLInfo.encoding;
        aInfo.format = RTLInfo.format;
        aInfo.resourceunit = RTLInfo.unit;
        aInfo.data = RTLInfo.data;
      };
      return Result;
    };
    $impl.IDPrefix = "resource-";
    $impl.GetHTMLResourceInfo = function (aName, aInfo) {
      var Result = false;
      var el = null;
      var S = "";
      var I = 0;
      Result = false;
      if (!pas.JS.isDefined(document)) return Result;
      el = document.getElementById($impl.IDPrefix + pas.SysUtils.LowerCase(aName));
      Result = (el != null) && pas.SysUtils.SameText(el.tagName,"link");
      if (!Result) return Result;
      aInfo.name = pas.SysUtils.LowerCase(aName);
      aInfo.resourceunit = "" + el.dataset["unit"];
      S = el.href;
      S = pas.System.Copy(S,6,S.length - 5);
      I = pas.System.Pos(",",S);
      aInfo.data = pas.System.Copy(S,I + 1,S.length - 1);
      S = pas.System.Copy(S,1,I - 1);
      I = pas.System.Pos(";",S);
      if (I === 0) {
        aInfo.encoding = ""}
       else {
        aInfo.encoding = pas.System.Copy(S,I + 1,S.length - 1);
        S = pas.System.Copy(S,1,I - 1);
      };
      aInfo.format = S;
      return Result;
    };
  };
},["SysUtils","JS","Web"]);
rtl.module("palette",["System"],function () {
  "use strict";
  var $mod = this;
  this.BLACK = 0;
  this.BLUE = 1;
  this.GREEN = 2;
  this.CYAN = 3;
  this.RED = 4;
  this.BROWN = 6;
  this.LIGHTGRAY = 7;
  this.LIGHTBLUE = 9;
  this.YELLOW = 14;
  this.WHITE = 15;
  rtl.recNewT(this,"TRMColorRec",function () {
    this.r = 0;
    this.g = 0;
    this.b = 0;
    this.$eq = function (b) {
      return (this.r === b.r) && (this.g === b.g) && (this.b === b.b);
    };
    this.$assign = function (s) {
      this.r = s.r;
      this.g = s.g;
      this.b = s.b;
      return this;
    };
  });
  this.VGADefault256$a$clone = function (a) {
    var r = [];
    for (var i = 0; i < 256; i++) r.push($mod.TRMColorRec.$clone(a[i]));
    return r;
  };
  this.VGADefault256 = [this.TRMColorRec.$clone({r: 0, g: 0, b: 0}),this.TRMColorRec.$clone({r: 0, g: 0, b: 170}),this.TRMColorRec.$clone({r: 0, g: 170, b: 0}),this.TRMColorRec.$clone({r: 0, g: 170, b: 170}),this.TRMColorRec.$clone({r: 170, g: 0, b: 0}),this.TRMColorRec.$clone({r: 170, g: 0, b: 170}),this.TRMColorRec.$clone({r: 170, g: 85, b: 0}),this.TRMColorRec.$clone({r: 170, g: 170, b: 170}),this.TRMColorRec.$clone({r: 85, g: 85, b: 85}),this.TRMColorRec.$clone({r: 85, g: 85, b: 255}),this.TRMColorRec.$clone({r: 85, g: 255, b: 85}),this.TRMColorRec.$clone({r: 85, g: 255, b: 255}),this.TRMColorRec.$clone({r: 255, g: 85, b: 85}),this.TRMColorRec.$clone({r: 255, g: 85, b: 255}),this.TRMColorRec.$clone({r: 255, g: 255, b: 85}),this.TRMColorRec.$clone({r: 255, g: 255, b: 255}),this.TRMColorRec.$clone({r: 0, g: 0, b: 0}),this.TRMColorRec.$clone({r: 20, g: 20, b: 20}),this.TRMColorRec.$clone({r: 32, g: 32, b: 32}),this.TRMColorRec.$clone({r: 44, g: 44, b: 44}),this.TRMColorRec.$clone({r: 56, g: 56, b: 56}),this.TRMColorRec.$clone({r: 68, g: 68, b: 68}),this.TRMColorRec.$clone({r: 80, g: 80, b: 80}),this.TRMColorRec.$clone({r: 96, g: 96, b: 96}),this.TRMColorRec.$clone({r: 112, g: 112, b: 112}),this.TRMColorRec.$clone({r: 128, g: 128, b: 128}),this.TRMColorRec.$clone({r: 144, g: 144, b: 144}),this.TRMColorRec.$clone({r: 160, g: 160, b: 160}),this.TRMColorRec.$clone({r: 180, g: 180, b: 180}),this.TRMColorRec.$clone({r: 200, g: 200, b: 200}),this.TRMColorRec.$clone({r: 224, g: 224, b: 224}),this.TRMColorRec.$clone({r: 252, g: 252, b: 252}),this.TRMColorRec.$clone({r: 0, g: 0, b: 252}),this.TRMColorRec.$clone({r: 64, g: 0, b: 252}),this.TRMColorRec.$clone({r: 124, g: 0, b: 252}),this.TRMColorRec.$clone({r: 188, g: 0, b: 252}),this.TRMColorRec.$clone({r: 252, g: 0, b: 252}),this.TRMColorRec.$clone({r: 252, g: 0, b: 188}),this.TRMColorRec.$clone({r: 252, g: 0, b: 124}),this.TRMColorRec.$clone({r: 252, g: 0, b: 64}),this.TRMColorRec.$clone({r: 252, g: 0, b: 0}),this.TRMColorRec.$clone({r: 252, g: 64, b: 0}),this.TRMColorRec.$clone({r: 252, g: 124, b: 0}),this.TRMColorRec.$clone({r: 252, g: 188, b: 0}),this.TRMColorRec.$clone({r: 252, g: 252, b: 0}),this.TRMColorRec.$clone({r: 188, g: 252, b: 0}),this.TRMColorRec.$clone({r: 124, g: 252, b: 0}),this.TRMColorRec.$clone({r: 64, g: 252, b: 0}),this.TRMColorRec.$clone({r: 0, g: 252, b: 0}),this.TRMColorRec.$clone({r: 0, g: 252, b: 64}),this.TRMColorRec.$clone({r: 0, g: 252, b: 124}),this.TRMColorRec.$clone({r: 0, g: 252, b: 188}),this.TRMColorRec.$clone({r: 0, g: 252, b: 252}),this.TRMColorRec.$clone({r: 0, g: 188, b: 252}),this.TRMColorRec.$clone({r: 0, g: 124, b: 252}),this.TRMColorRec.$clone({r: 0, g: 64, b: 252}),this.TRMColorRec.$clone({r: 124, g: 124, b: 252}),this.TRMColorRec.$clone({r: 156, g: 124, b: 252}),this.TRMColorRec.$clone({r: 188, g: 124, b: 252}),this.TRMColorRec.$clone({r: 220, g: 124, b: 252}),this.TRMColorRec.$clone({r: 252, g: 124, b: 252}),this.TRMColorRec.$clone({r: 252, g: 124, b: 220}),this.TRMColorRec.$clone({r: 252, g: 124, b: 188}),this.TRMColorRec.$clone({r: 252, g: 124, b: 156}),this.TRMColorRec.$clone({r: 252, g: 124, b: 124}),this.TRMColorRec.$clone({r: 252, g: 156, b: 124}),this.TRMColorRec.$clone({r: 252, g: 188, b: 124}),this.TRMColorRec.$clone({r: 252, g: 220, b: 124}),this.TRMColorRec.$clone({r: 252, g: 252, b: 124}),this.TRMColorRec.$clone({r: 220, g: 252, b: 124}),this.TRMColorRec.$clone({r: 188, g: 252, b: 124}),this.TRMColorRec.$clone({r: 156, g: 252, b: 124}),this.TRMColorRec.$clone({r: 124, g: 252, b: 124}),this.TRMColorRec.$clone({r: 124, g: 252, b: 156}),this.TRMColorRec.$clone({r: 124, g: 252, b: 188}),this.TRMColorRec.$clone({r: 124, g: 252, b: 220}),this.TRMColorRec.$clone({r: 124, g: 252, b: 252}),this.TRMColorRec.$clone({r: 124, g: 220, b: 252}),this.TRMColorRec.$clone({r: 124, g: 188, b: 252}),this.TRMColorRec.$clone({r: 124, g: 156, b: 252}),this.TRMColorRec.$clone({r: 180, g: 180, b: 252}),this.TRMColorRec.$clone({r: 196, g: 180, b: 252}),this.TRMColorRec.$clone({r: 216, g: 180, b: 252}),this.TRMColorRec.$clone({r: 232, g: 180, b: 252}),this.TRMColorRec.$clone({r: 252, g: 180, b: 252}),this.TRMColorRec.$clone({r: 252, g: 180, b: 232}),this.TRMColorRec.$clone({r: 252, g: 180, b: 216}),this.TRMColorRec.$clone({r: 252, g: 180, b: 196}),this.TRMColorRec.$clone({r: 252, g: 180, b: 180}),this.TRMColorRec.$clone({r: 252, g: 196, b: 180}),this.TRMColorRec.$clone({r: 252, g: 216, b: 180}),this.TRMColorRec.$clone({r: 252, g: 232, b: 180}),this.TRMColorRec.$clone({r: 252, g: 252, b: 180}),this.TRMColorRec.$clone({r: 232, g: 252, b: 180}),this.TRMColorRec.$clone({r: 216, g: 252, b: 180}),this.TRMColorRec.$clone({r: 196, g: 252, b: 180}),this.TRMColorRec.$clone({r: 180, g: 252, b: 180}),this.TRMColorRec.$clone({r: 180, g: 252, b: 196}),this.TRMColorRec.$clone({r: 180, g: 252, b: 216}),this.TRMColorRec.$clone({r: 180, g: 252, b: 232}),this.TRMColorRec.$clone({r: 180, g: 252, b: 252}),this.TRMColorRec.$clone({r: 180, g: 232, b: 252}),this.TRMColorRec.$clone({r: 180, g: 216, b: 252}),this.TRMColorRec.$clone({r: 180, g: 196, b: 252}),this.TRMColorRec.$clone({r: 0, g: 0, b: 112}),this.TRMColorRec.$clone({r: 28, g: 0, b: 112}),this.TRMColorRec.$clone({r: 56, g: 0, b: 112}),this.TRMColorRec.$clone({r: 84, g: 0, b: 112}),this.TRMColorRec.$clone({r: 112, g: 0, b: 112}),this.TRMColorRec.$clone({r: 112, g: 0, b: 84}),this.TRMColorRec.$clone({r: 112, g: 0, b: 56}),this.TRMColorRec.$clone({r: 112, g: 0, b: 28}),this.TRMColorRec.$clone({r: 112, g: 0, b: 0}),this.TRMColorRec.$clone({r: 112, g: 28, b: 0}),this.TRMColorRec.$clone({r: 112, g: 56, b: 0}),this.TRMColorRec.$clone({r: 112, g: 84, b: 0}),this.TRMColorRec.$clone({r: 112, g: 112, b: 0}),this.TRMColorRec.$clone({r: 84, g: 112, b: 0}),this.TRMColorRec.$clone({r: 56, g: 112, b: 0}),this.TRMColorRec.$clone({r: 28, g: 112, b: 0}),this.TRMColorRec.$clone({r: 0, g: 112, b: 0}),this.TRMColorRec.$clone({r: 0, g: 112, b: 28}),this.TRMColorRec.$clone({r: 0, g: 112, b: 56}),this.TRMColorRec.$clone({r: 0, g: 112, b: 84}),this.TRMColorRec.$clone({r: 0, g: 112, b: 112}),this.TRMColorRec.$clone({r: 0, g: 84, b: 112}),this.TRMColorRec.$clone({r: 0, g: 56, b: 112}),this.TRMColorRec.$clone({r: 0, g: 28, b: 112}),this.TRMColorRec.$clone({r: 56, g: 56, b: 112}),this.TRMColorRec.$clone({r: 68, g: 56, b: 112}),this.TRMColorRec.$clone({r: 84, g: 56, b: 112}),this.TRMColorRec.$clone({r: 96, g: 56, b: 112}),this.TRMColorRec.$clone({r: 112, g: 56, b: 112}),this.TRMColorRec.$clone({r: 112, g: 56, b: 96}),this.TRMColorRec.$clone({r: 112, g: 56, b: 84}),this.TRMColorRec.$clone({r: 112, g: 56, b: 68}),this.TRMColorRec.$clone({r: 112, g: 56, b: 56}),this.TRMColorRec.$clone({r: 112, g: 68, b: 56}),this.TRMColorRec.$clone({r: 112, g: 84, b: 56}),this.TRMColorRec.$clone({r: 112, g: 96, b: 56}),this.TRMColorRec.$clone({r: 112, g: 112, b: 56}),this.TRMColorRec.$clone({r: 96, g: 112, b: 56}),this.TRMColorRec.$clone({r: 84, g: 112, b: 56}),this.TRMColorRec.$clone({r: 68, g: 112, b: 56}),this.TRMColorRec.$clone({r: 56, g: 112, b: 56}),this.TRMColorRec.$clone({r: 56, g: 112, b: 68}),this.TRMColorRec.$clone({r: 56, g: 112, b: 84}),this.TRMColorRec.$clone({r: 56, g: 112, b: 96}),this.TRMColorRec.$clone({r: 56, g: 112, b: 112}),this.TRMColorRec.$clone({r: 56, g: 96, b: 112}),this.TRMColorRec.$clone({r: 56, g: 84, b: 112}),this.TRMColorRec.$clone({r: 56, g: 68, b: 112}),this.TRMColorRec.$clone({r: 80, g: 80, b: 112}),this.TRMColorRec.$clone({r: 88, g: 80, b: 112}),this.TRMColorRec.$clone({r: 96, g: 80, b: 112}),this.TRMColorRec.$clone({r: 104, g: 80, b: 112}),this.TRMColorRec.$clone({r: 112, g: 80, b: 112}),this.TRMColorRec.$clone({r: 112, g: 80, b: 104}),this.TRMColorRec.$clone({r: 112, g: 80, b: 96}),this.TRMColorRec.$clone({r: 112, g: 80, b: 88}),this.TRMColorRec.$clone({r: 112, g: 80, b: 80}),this.TRMColorRec.$clone({r: 112, g: 88, b: 80}),this.TRMColorRec.$clone({r: 112, g: 96, b: 80}),this.TRMColorRec.$clone({r: 112, g: 104, b: 80}),this.TRMColorRec.$clone({r: 112, g: 112, b: 80}),this.TRMColorRec.$clone({r: 104, g: 112, b: 80}),this.TRMColorRec.$clone({r: 96, g: 112, b: 80}),this.TRMColorRec.$clone({r: 88, g: 112, b: 80}),this.TRMColorRec.$clone({r: 80, g: 112, b: 80}),this.TRMColorRec.$clone({r: 80, g: 112, b: 88}),this.TRMColorRec.$clone({r: 80, g: 112, b: 96}),this.TRMColorRec.$clone({r: 80, g: 112, b: 104}),this.TRMColorRec.$clone({r: 80, g: 112, b: 112}),this.TRMColorRec.$clone({r: 80, g: 104, b: 112}),this.TRMColorRec.$clone({r: 80, g: 96, b: 112}),this.TRMColorRec.$clone({r: 80, g: 88, b: 112}),this.TRMColorRec.$clone({r: 0, g: 0, b: 64}),this.TRMColorRec.$clone({r: 16, g: 0, b: 64}),this.TRMColorRec.$clone({r: 32, g: 0, b: 64}),this.TRMColorRec.$clone({r: 48, g: 0, b: 64}),this.TRMColorRec.$clone({r: 64, g: 0, b: 64}),this.TRMColorRec.$clone({r: 64, g: 0, b: 48}),this.TRMColorRec.$clone({r: 64, g: 0, b: 32}),this.TRMColorRec.$clone({r: 64, g: 0, b: 16}),this.TRMColorRec.$clone({r: 64, g: 0, b: 0}),this.TRMColorRec.$clone({r: 64, g: 16, b: 0}),this.TRMColorRec.$clone({r: 64, g: 32, b: 0}),this.TRMColorRec.$clone({r: 64, g: 48, b: 0}),this.TRMColorRec.$clone({r: 64, g: 64, b: 0}),this.TRMColorRec.$clone({r: 48, g: 64, b: 0}),this.TRMColorRec.$clone({r: 32, g: 64, b: 0}),this.TRMColorRec.$clone({r: 16, g: 64, b: 0}),this.TRMColorRec.$clone({r: 0, g: 64, b: 0}),this.TRMColorRec.$clone({r: 0, g: 64, b: 16}),this.TRMColorRec.$clone({r: 0, g: 64, b: 32}),this.TRMColorRec.$clone({r: 0, g: 64, b: 48}),this.TRMColorRec.$clone({r: 0, g: 64, b: 64}),this.TRMColorRec.$clone({r: 0, g: 48, b: 64}),this.TRMColorRec.$clone({r: 0, g: 32, b: 64}),this.TRMColorRec.$clone({r: 0, g: 16, b: 64}),this.TRMColorRec.$clone({r: 32, g: 32, b: 64}),this.TRMColorRec.$clone({r: 40, g: 32, b: 64}),this.TRMColorRec.$clone({r: 48, g: 32, b: 64}),this.TRMColorRec.$clone({r: 56, g: 32, b: 64}),this.TRMColorRec.$clone({r: 64, g: 32, b: 64}),this.TRMColorRec.$clone({r: 64, g: 32, b: 56}),this.TRMColorRec.$clone({r: 64, g: 32, b: 48}),this.TRMColorRec.$clone({r: 64, g: 32, b: 40}),this.TRMColorRec.$clone({r: 64, g: 32, b: 32}),this.TRMColorRec.$clone({r: 64, g: 40, b: 32}),this.TRMColorRec.$clone({r: 64, g: 48, b: 32}),this.TRMColorRec.$clone({r: 64, g: 56, b: 32}),this.TRMColorRec.$clone({r: 64, g: 64, b: 32}),this.TRMColorRec.$clone({r: 56, g: 64, b: 32}),this.TRMColorRec.$clone({r: 48, g: 64, b: 32}),this.TRMColorRec.$clone({r: 40, g: 64, b: 32}),this.TRMColorRec.$clone({r: 32, g: 64, b: 32}),this.TRMColorRec.$clone({r: 32, g: 64, b: 40}),this.TRMColorRec.$clone({r: 32, g: 64, b: 48}),this.TRMColorRec.$clone({r: 32, g: 64, b: 56}),this.TRMColorRec.$clone({r: 32, g: 64, b: 64}),this.TRMColorRec.$clone({r: 32, g: 56, b: 64}),this.TRMColorRec.$clone({r: 32, g: 48, b: 64}),this.TRMColorRec.$clone({r: 32, g: 40, b: 64}),this.TRMColorRec.$clone({r: 44, g: 44, b: 64}),this.TRMColorRec.$clone({r: 48, g: 44, b: 64}),this.TRMColorRec.$clone({r: 52, g: 44, b: 64}),this.TRMColorRec.$clone({r: 60, g: 44, b: 64}),this.TRMColorRec.$clone({r: 64, g: 44, b: 64}),this.TRMColorRec.$clone({r: 64, g: 44, b: 60}),this.TRMColorRec.$clone({r: 64, g: 44, b: 52}),this.TRMColorRec.$clone({r: 64, g: 44, b: 48}),this.TRMColorRec.$clone({r: 64, g: 44, b: 44}),this.TRMColorRec.$clone({r: 64, g: 48, b: 44}),this.TRMColorRec.$clone({r: 64, g: 52, b: 44}),this.TRMColorRec.$clone({r: 64, g: 60, b: 44}),this.TRMColorRec.$clone({r: 64, g: 64, b: 44}),this.TRMColorRec.$clone({r: 60, g: 64, b: 44}),this.TRMColorRec.$clone({r: 52, g: 64, b: 44}),this.TRMColorRec.$clone({r: 48, g: 64, b: 44}),this.TRMColorRec.$clone({r: 44, g: 64, b: 44}),this.TRMColorRec.$clone({r: 44, g: 64, b: 48}),this.TRMColorRec.$clone({r: 44, g: 64, b: 52}),this.TRMColorRec.$clone({r: 44, g: 64, b: 60}),this.TRMColorRec.$clone({r: 44, g: 64, b: 64}),this.TRMColorRec.$clone({r: 44, g: 60, b: 64}),this.TRMColorRec.$clone({r: 44, g: 52, b: 64}),this.TRMColorRec.$clone({r: 44, g: 48, b: 64}),this.TRMColorRec.$clone({r: 0, g: 0, b: 0}),this.TRMColorRec.$clone({r: 0, g: 0, b: 0}),this.TRMColorRec.$clone({r: 0, g: 0, b: 0}),this.TRMColorRec.$clone({r: 0, g: 0, b: 0}),this.TRMColorRec.$clone({r: 0, g: 0, b: 0}),this.TRMColorRec.$clone({r: 0, g: 0, b: 0}),this.TRMColorRec.$clone({r: 0, g: 0, b: 0}),this.TRMColorRec.$clone({r: 0, g: 0, b: 0})];
  this.GetRGBVGA = function (index, cr) {
    cr.$assign($mod.VGADefault256[index]);
  };
  $mod.$init = function () {
  };
});
rtl.module("RESread",["System","Web","p2jsres"],function () {
  "use strict";
  var $mod = this;
  rtl.recNewT(this,"FileRes",function () {
    this.Buffer = "";
    this.Length = 0;
    this.Position = 0;
    this.$eq = function (b) {
      return (this.Buffer === b.Buffer) && (this.Length === b.Length) && (this.Position === b.Position);
    };
    this.$assign = function (s) {
      this.Buffer = s.Buffer;
      this.Length = s.Length;
      this.Position = s.Position;
      return this;
    };
  });
  this.RESAssignFile = function (F, resID) {
    var Info = pas.p2jsres.TResourceInfo.$new();
    F.Position = 0;
    F.Length = 0;
    if (!pas.p2jsres.GetResourceInfo(resID,Info)) {
      pas.System.Writeln("No info for RES file!");
    } else {
      F.Buffer = window.atob(Info.data);
      F.Length = F.Buffer.length;
    };
  };
  this.RESreadByte = function (F) {
    var Result = 0;
    Result = 0;
    if (F.Position !== F.Length) {
      F.Position += 1;
      Result = F.Buffer.charCodeAt(F.Position - 1);
    };
    return Result;
  };
  $mod.$init = function () {
  };
});
rtl.module("Bits",["System"],function () {
  "use strict";
  var $mod = this;
  this.BitOn = function (Position, Testbyte) {
    var Result = false;
    var Bt = 0;
    Bt = 0x1;
    Bt = Bt << Position;
    Result = (Bt & Testbyte) > 0;
    return Result;
  };
  $mod.$init = function () {
  };
});
rtl.module("bitfonts",["System","RESread","Bits"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.GetFontPixel = function (c, x, y) {
    var Result = 0;
    Result = $impl.CurrentFont[c].BitMap[x][y];
    return Result;
  };
  this.InitBitFonts = function () {
    $impl.DefPutPixelProc = $impl.DefPutPixel;
    $mod.LoadBitFont("ibmfontvga");
  };
  this.LoadBitFont = function (filename) {
    var F = pas.RESread.FileRes.$new();
    pas.RESread.RESAssignFile(F,filename);
    $impl.Load256Chars(F);
  };
  this.SetBitFontPixelProc = function (CustomPutPixel) {
    $impl.DefPutPixelProc = CustomPutPixel;
  };
  $mod.$implcode = function () {
    rtl.recNewT($impl,"FontCharRec",function () {
      this.$new = function () {
        var r = Object.create(this);
        r.BitMap = rtl.arraySetLength(null,0,8,8);
        return r;
      };
      this.$eq = function (b) {
        return rtl.arrayEq(this.BitMap,b.BitMap);
      };
      this.$assign = function (s) {
        this.BitMap = s.BitMap.slice(0);
        return this;
      };
    });
    $impl.FontRec$clone = function (a) {
      var r = [];
      for (var i = 0; i < 256; i++) r.push($impl.FontCharRec.$clone(a[i]));
      return r;
    };
    $impl.CurrentFont = rtl.arraySetLength(null,$impl.FontCharRec,256);
    $impl.DefPutPixelProc = null;
    $impl.DefPutPixel = function (x, y) {
    };
    $impl.Load256Chars = function (F) {
      var i = 0;
      var j = 0;
      var k = 0;
      var FontCharLine = 0;
      for (k = 0; k <= 255; k++) {
        for (j = 0; j <= 7; j++) {
          FontCharLine = pas.RESread.RESreadByte(F);
          for (i = 0; i <= 7; i++) {
            if (pas.Bits.BitOn(7 - i,FontCharLine)) {
              $impl.CurrentFont[k].BitMap[i][j] = 1;
            } else {
              $impl.CurrentFont[k].BitMap[i][j] = 0;
            };
          };
        };
      };
    };
  };
  $mod.$init = function () {
  };
},[]);
rtl.module("graph",["System","Web","palette","bitfonts","SysUtils"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.VGA = 9;
  this.VGAHi = 2;
  this.SolidFill = 0;
  this.xHatchFill = 1;
  this.DefaultFont = 1;
  this.LatoFont = 2;
  this.HorizDir = 1;
  this.InitGraph = function (gd, gm, path) {
    $impl.GraphicsMode = gm;
    $impl.GraphicsDriver = gd;
    if (($impl.GraphicsDriver === 9) && ($impl.GraphicsMode === 2)) {
      $impl.ScreenWidth = 800;
      $impl.ScreenHeight = 480;
      $impl.InitCanvas(pas.System.Trunc($impl.ScreenWidth * 1.5),pas.System.Trunc($impl.ScreenHeight * 1.5));
      $impl.SetScale(1.5,1.5);
    };
    pas.bitfonts.InitBitFonts();
    pas.bitfonts.SetBitFontPixelProc($mod.BitFontPutPixel);
  };
  this.Bar = function (x, y, x2, y2) {
    var width = 0;
    var height = 0;
    var cr = pas.palette.TRMColorRec.$new();
    var temp = 0;
    if (x > x2) {
      temp = x2;
      x2 = x;
      x = temp;
    };
    if (y > y2) {
      temp = y2;
      y2 = y;
      y = temp;
    };
    pas.palette.GetRGBVGA($impl.FillColor,cr);
    $impl.ctx.fillStyle = "rgb(" + pas.SysUtils.IntToStr(cr.r) + "," + pas.SysUtils.IntToStr(cr.g) + "," + pas.SysUtils.IntToStr(cr.b) + ")";
    width = pas.System.Trunc((Math.abs(x2 - x) + 1) * $impl.xscale);
    height = pas.System.Trunc((Math.abs(y2 - y) + 1) * $impl.yscale);
    $impl.ctx.fillRect(x * $impl.xscale,y * $impl.yscale,width,height);
  };
  this.Rectangle = function (x, y, x2, y2) {
    var width = 0;
    var height = 0;
    var cr = pas.palette.TRMColorRec.$new();
    var temp = 0;
    pas.palette.GetRGBVGA($impl.Color,cr);
    if (x > x2) {
      temp = x2;
      x2 = x;
      x = temp;
    };
    if (y > y2) {
      temp = y2;
      y2 = y;
      y = temp;
    };
    width = pas.System.Trunc((Math.abs(x2 - x) + 1) * $impl.xscale);
    height = pas.System.Trunc((Math.abs(y2 - y) + 1) * $impl.yscale);
    $impl.ctx.strokeStyle = "rgb(" + pas.SysUtils.IntToStr(cr.r) + "," + pas.SysUtils.IntToStr(cr.g) + "," + pas.SysUtils.IntToStr(cr.b) + ")";
    $impl.ctx.lineWidth = $impl.xscale;
    $impl.ctx.strokeRect(x * $impl.xscale,y * $impl.yscale,width,height);
  };
  this.Line = function (x, y, x2, y2) {
    var cr = pas.palette.TRMColorRec.$new();
    pas.palette.GetRGBVGA($impl.Color,cr);
    $impl.ctx.strokeStyle = "rgb(" + pas.SysUtils.IntToStr(cr.r) + "," + pas.SysUtils.IntToStr(cr.g) + "," + pas.SysUtils.IntToStr(cr.b) + ")";
    $impl.ctx.lineWidth = $impl.xscale;
    $impl.ctx.beginPath();
    $impl.ctx.moveTo(x * $impl.xscale,y * $impl.yscale);
    $impl.ctx.lineTo(x2 * $impl.xscale,y2 * $impl.yscale);
    $impl.ctx.stroke();
  };
  this.FillEllipse = function (x, y, r1, r2) {
    var cr = pas.palette.TRMColorRec.$new();
    $impl.ctx.beginPath();
    $impl.ctx.lineWidth = $impl.xscale;
    $impl.ctx.ellipse(x * $impl.xscale,y * $impl.yscale,r1 * $impl.xscale,r2 * $impl.yscale,0,0,2 * Math.PI);
    pas.palette.GetRGBVGA($impl.Color,cr);
    $impl.ctx.strokeStyle = "rgb(" + pas.SysUtils.IntToStr(cr.r) + "," + pas.SysUtils.IntToStr(cr.g) + "," + pas.SysUtils.IntToStr(cr.b) + ")";
    $impl.ctx.stroke();
    pas.palette.GetRGBVGA($impl.FillColor,cr);
    $impl.ctx.fillStyle = "rgb(" + pas.SysUtils.IntToStr(cr.r) + "," + pas.SysUtils.IntToStr(cr.g) + "," + pas.SysUtils.IntToStr(cr.b) + ")";
    $impl.ctx.fill();
  };
  this.SetTextStyle = function (Font, Direction, Size) {
    $impl.FontName = Font;
    $impl.FontSize = Size;
    $impl.FontDirection = Direction;
    $impl.FontPixelSize = pas.System.Trunc(Size * $impl.xscale);
    if ($impl.FontName === 2) $impl.ctx.font = "28px lato";
  };
  this.OutTextXY = function (x, y, text) {
    var cr = pas.palette.TRMColorRec.$new();
    pas.palette.GetRGBVGA($impl.Color,cr);
    $impl.ctx.fillStyle = "rgb(" + pas.SysUtils.IntToStr(cr.r) + "," + pas.SysUtils.IntToStr(cr.g) + "," + pas.SysUtils.IntToStr(cr.b) + ")";
    if ($impl.FontName === 1) {
      $impl.BitFontTextOutXY(x,y,text);
    } else {
      $impl.ctx.fillText(text,x * $impl.xscale,y * $impl.yscale);
    };
  };
  this.putpixel$1 = function (x, y) {
    var cr = pas.palette.TRMColorRec.$new();
    pas.palette.GetRGBVGA($impl.Color,cr);
    $impl.ctx.fillStyle = "rgb(" + pas.SysUtils.IntToStr(cr.r) + "," + pas.SysUtils.IntToStr(cr.g) + "," + pas.SysUtils.IntToStr(cr.b) + ")";
    $impl.ctx.fillRect(x * $impl.xscale,y * $impl.yscale,$impl.xscale,$impl.yscale);
  };
  this.SetFillStyle = function (fstyle, fcolor) {
    var cr = pas.palette.TRMColorRec.$new();
    $impl.FillStyle = fstyle;
    $impl.FillColor = fcolor;
    pas.palette.GetRGBVGA(fcolor,cr);
    $impl.ctx.fillStyle = "rgb(" + pas.SysUtils.IntToStr(cr.r) + "," + pas.SysUtils.IntToStr(cr.g) + "," + pas.SysUtils.IntToStr(cr.b) + ")";
  };
  this.SetColor = function (col) {
    $impl.Color = col;
  };
  this.BitFontPutPixel = function (x, y) {
    $mod.putpixel$1(x,y);
  };
  $mod.$implcode = function () {
    $impl.canvas = null;
    $impl.ctx = null;
    $impl.xscale = 0.0;
    $impl.yscale = 0.0;
    $impl.GraphicsMode = 0;
    $impl.GraphicsDriver = 0;
    $impl.ScreenWidth = 0;
    $impl.ScreenHeight = 0;
    $impl.FillStyle = 0;
    $impl.FillColor = 0;
    $impl.Color = 0;
    $impl.FontName = 0;
    $impl.FontSize = 0;
    $impl.FontDirection = 0;
    $impl.FontPixelSize = 0;
    $impl.InitCanvas = function (width, height) {
      $impl.canvas = document.getElementById("canvas");
      $impl.ctx = $impl.canvas.getContext("2d");
      $impl.canvas.width = width;
      $impl.canvas.height = height;
    };
    $impl.SetScale = function (xsize, ysize) {
      $impl.xscale = xsize;
      $impl.yscale = ysize;
    };
    $impl.BitFontTextOutXY = function (x, y, text) {
      var i = 0;
      var j = 0;
      var k = 0;
      var pwidth = 0;
      var pheight = 0;
      var xpos = 0;
      var ypos = 0;
      pwidth = 2;
      pheight = 2;
      if ($impl.FontSize === 1) {}
      else if ($impl.FontSize === 2) {
        pwidth = pas.System.Trunc(2 * $impl.xscale);
        pheight = pas.System.Trunc(2 * $impl.yscale);
      };
      xpos = pas.System.Trunc(x * $impl.xscale);
      ypos = pas.System.Trunc(y * $impl.yscale);
      for (var $l = 1, $end = text.length; $l <= $end; $l++) {
        k = $l;
        for (j = 0; j <= 7; j++) {
          for (i = 0; i <= 7; i++) {
            if (pas.bitfonts.GetFontPixel(text.charCodeAt(k - 1),i,j) === 1) {
              $impl.ctx.fillRect(xpos + (i * pwidth),ypos + (j * pheight),pwidth,pheight);
            };
          };
        };
        xpos += pwidth * 8;
      };
    };
  };
  $mod.$init = function () {
  };
},[]);
rtl.module("squeue",["System"],function () {
  "use strict";
  var $mod = this;
  this.MaxQueue = 1000;
  rtl.recNewT(this,"LocationRec",function () {
    this.x = 0;
    this.y = 0;
    this.direction = 0;
    this.$eq = function (b) {
      return (this.x === b.x) && (this.y === b.y) && (this.direction === b.direction);
    };
    this.$assign = function (s) {
      this.x = s.x;
      this.y = s.y;
      this.direction = s.direction;
      return this;
    };
  });
  rtl.recNewT(this,"SimpleQueueRec",function () {
    this.c = 0;
    this.qlist$a$clone = function (a) {
      var r = [];
      for (var i = 0; i < 1000; i++) r.push($mod.LocationRec.$clone(a[i]));
      return r;
    };
    this.$new = function () {
      var r = Object.create(this);
      r.qlist = rtl.arraySetLength(null,$mod.LocationRec,1000);
      return r;
    };
    this.$eq = function (b) {
      return (this.c === b.c) && rtl.arrayEq(this.qlist,b.qlist);
    };
    this.$assign = function (s) {
      this.c = s.c;
      this.qlist = this.qlist$a$clone(s.qlist);
      return this;
    };
  });
  this.InitSQueue = function (SQ) {
    SQ.c = 0;
  };
  this.SQueuePush = function (SQ, qr) {
    if (SQ.c < 1000) {
      SQ.c += 1;
      SQ.qlist[SQ.c - 1].$assign(qr);
    };
  };
  this.SQueueGet = function (SQ, n, qr) {
    qr.$assign(SQ.qlist[n - 1]);
  };
  this.SQueuePopFirst = function (SQ, qr) {
    var i = 0;
    if (SQ.c > 0) {
      qr.$assign(SQ.qlist[0]);
      SQ.c -= 1;
      for (var $l = 1, $end = SQ.c; $l <= $end; $l++) {
        i = $l;
        SQ.qlist[i - 1].$assign(SQ.qlist[(i + 1) - 1]);
      };
    };
  };
  this.SQueueCount = function (SQ) {
    var Result = 0;
    Result = SQ.c;
    return Result;
  };
  $mod.$init = function () {
  };
});
rtl.module("PathFind",["System","squeue"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.VSIZE = 9;
  this.HSIZE = 9;
  this.ClearGrid = function (TGrid) {
    var i = 0;
    var j = 0;
    for (j = 0; j <= 8; j++) {
      for (i = 0; i <= 8; i++) {
        TGrid.get()[i][j] = 0;
      };
    };
  };
  this.PlaceWall = function (TGrid, x, y) {
    TGrid.get()[x][y] = 11;
  };
  this.PlaceSource = function (TGrid, x, y) {
    TGrid.get()[x][y] = 9;
  };
  this.PlaceTarget = function (TGrid, x, y) {
    TGrid.get()[x][y] = 10;
  };
  this.FindPointPath = function (TGrid, StartX, StartY, StartDir, PathQueue) {
    var Result = 0;
    var CP = pas.squeue.LocationRec.$new();
    var NP = pas.squeue.LocationRec.$new();
    Result = 0;
    if ($impl.isGoodStart(TGrid,StartX,StartY,StartDir) === false) return Result;
    CP.x = StartX;
    CP.y = StartY;
    CP.direction = StartDir;
    while ($impl.FindPointNext(TGrid,CP.x,CP.y,CP.direction,NP)) {
      if (NP.direction === 10) {
        if (pas.squeue.SQueueCount(PathQueue) > 0) Result = pas.squeue.SQueueCount(PathQueue);
        return Result;
      };
      pas.squeue.SQueuePush(PathQueue,pas.squeue.LocationRec.$clone(NP));
      CP.$assign(NP);
    };
    return Result;
  };
  this.PlaceDirectionArrows = function (TQueue, TGrid, x, y) {
    $impl.PlaceDirShape(TQueue,TGrid,x + 1,y,2);
    $impl.PlaceDirShape(TQueue,TGrid,x,y + 1,4);
    $impl.PlaceDirShape(TQueue,TGrid,x - 1,y,1);
    $impl.PlaceDirShape(TQueue,TGrid,x,y - 1,3);
  };
  this.FindTargetPath = function (PGrid, sx, sy, tx, ty, FoundPath) {
    var Result = false;
    var Queue = pas.squeue.SimpleQueueRec.$new();
    var qr = pas.squeue.LocationRec.$new();
    var found = 0;
    Result = false;
    pas.squeue.InitSQueue(Queue);
    $mod.PlaceSource(PGrid,sx,sy);
    $mod.PlaceTarget(PGrid,tx,ty);
    $mod.PlaceDirectionArrows(Queue,PGrid,tx,ty);
    while (pas.squeue.SQueueCount(Queue) !== 0) {
      pas.squeue.SQueuePopFirst(Queue,qr);
      $mod.PlaceDirectionArrows(Queue,PGrid,qr.x,qr.y);
    };
    pas.squeue.InitSQueue(FoundPath);
    found = $mod.FindPointPath(PGrid,sx,sy,4,FoundPath);
    if (found === 0) {
      pas.squeue.InitSQueue(FoundPath);
      found = $mod.FindPointPath(PGrid,sx,sy,1,FoundPath);
    };
    if (found === 0) {
      pas.squeue.InitSQueue(FoundPath);
      found = $mod.FindPointPath(PGrid,sx,sy,3,FoundPath);
    };
    if (found === 0) {
      pas.squeue.InitSQueue(FoundPath);
      found = $mod.FindPointPath(PGrid,sx,sy,2,FoundPath);
    };
    if (found > 0) Result = true;
    return Result;
  };
  this.G_Empty = 0;
  this.G_Left = 1;
  this.G_Right = 2;
  this.G_Up = 3;
  this.G_Down = 4;
  this.G_Source = 9;
  this.G_Target = 10;
  this.G_Wall = 11;
  $mod.$implcode = function () {
    $impl.GetReverseDir = function (inDir) {
      var Result = 0;
      var $tmp = inDir;
      if ($tmp === 3) {
        Result = 4}
       else if ($tmp === 4) {
        Result = 3}
       else if ($tmp === 1) {
        Result = 2}
       else if ($tmp === 2) {
        Result = 1}
       else if ($tmp === 10) Result = 10;
      return Result;
    };
    $impl.FindPointNext = function (TGrid, x, y, dir, np) {
      var Result = false;
      Result = false;
      if ((x < 0) || (y < 0) || (x > (9 - 1)) || (y > (9 - 1))) return Result;
      if (TGrid.get()[x][y] === 10) return Result;
      if ((dir === 3) && (y > 0)) {
        np.x = x;
        np.y = y - 1;
        np.direction = $impl.GetReverseDir(TGrid.get()[x][y - 1]);
        Result = true;
      } else if ((dir === 1) && (x > 0)) {
        np.x = x - 1;
        np.y = y;
        np.direction = $impl.GetReverseDir(TGrid.get()[x - 1][y]);
        Result = true;
      } else if ((dir === 4) && (y < (9 - 1))) {
        np.x = x;
        np.y = y + 1;
        np.direction = $impl.GetReverseDir(TGrid.get()[x][y + 1]);
        Result = true;
      } else if ((dir === 2) && (x < (9 - 1))) {
        np.x = x + 1;
        np.y = y;
        np.direction = $impl.GetReverseDir(TGrid.get()[x + 1][y]);
        Result = true;
      };
      return Result;
    };
    $impl.isGoodStart = function (TGrid, StartX, StartY, StartDir) {
      var Result = false;
      var nx = 0;
      var ny = 0;
      var goodxy = false;
      nx = StartX;
      ny = StartY;
      if (StartDir === 3) ny -= 1;
      if (StartDir === 4) ny += 1;
      if (StartDir === 1) nx -= 1;
      if (StartDir === 2) nx += 1;
      goodxy = (nx >= 0) && (nx < 9) && (ny >= 0) && (ny < 9);
      Result = goodxy && (TGrid.get()[nx][ny] !== 11);
      return Result;
    };
    $impl.PlaceDirShape = function (TQueue, TGrid, x, y, G_Dir) {
      var QR = pas.squeue.LocationRec.$new();
      if ((x < 0) || (x > (9 - 1)) || (y < 0) || (y > (9 - 1))) return;
      if (TGrid.get()[x][y] !== 0) return;
      TGrid.get()[x][y] = G_Dir;
      QR.x = x;
      QR.y = y;
      QR.direction = G_Dir;
      pas.squeue.SQueuePush(TQueue,pas.squeue.LocationRec.$clone(QR));
    };
  };
  $mod.$init = function () {
  };
},[]);
rtl.module("fiveline",["System","Web","graph","palette","PathFind","squeue"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.ProgramName = "Fiveline v1.1";
  this.ProgramAuthor = "RetroNick";
  this.ProgramReleaseDate = "October 5 - 2021";
  this.HSize = 9;
  this.VSize = 9;
  this.GBItemRadius = 10;
  this.GBSQWidth = 30;
  this.GBSQHeight = 30;
  this.GBSQThick = 4;
  this.GBItemEmpty = 0;
  this.GBItemCrossHair = 1;
  this.GBItemLocked = 2;
  this.GBItemUnLocked = 3;
  this.GBItemBorder = 4;
  this.GBItemBorderRemove = 5;
  this.GBItemRed = 10;
  this.GBItemGreen = 11;
  this.GBItemBrown = 12;
  this.GBItemCyan = 13;
  this.GBItemLightBlue = 14;
  this.GBItemLightGray = 15;
  this.GBItemBrick = 16;
  this.UP = 72;
  this.DOWN = 80;
  this.LEFT = 75;
  this.RIGHT = 77;
  this.ENTER = 13;
  this.CHEAT = 100;
  this.QUIT = 101;
  this.START = 102;
  this.KEY0 = 103;
  this.KEY1 = 104;
  this.KEY2 = 105;
  this.KEY3 = 106;
  this.KEY4 = 107;
  this.KEY5 = 108;
  this.KEY6 = 109;
  rtl.recNewT(this,"GameBoardRec",function () {
    this.Item = 0;
    this.$eq = function (b) {
      return this.Item === b.Item;
    };
    this.$assign = function (s) {
      this.Item = s.Item;
      return this;
    };
  });
  rtl.recNewT(this,"itempoints",function () {
    this.x = 0;
    this.y = 0;
    this.stepx = 0;
    this.stepy = 0;
    this.item = 0;
    this.count = 0;
    this.$eq = function (b) {
      return (this.x === b.x) && (this.y === b.y) && (this.stepx === b.stepx) && (this.stepy === b.stepy) && (this.item === b.item) && (this.count === b.count);
    };
    this.$assign = function (s) {
      this.x = s.x;
      this.y = s.y;
      this.stepx = s.stepx;
      this.stepy = s.stepy;
      this.item = s.item;
      this.count = s.count;
      return this;
    };
  });
  rtl.recNewT(this,"ItemLockRec",function () {
    this.isLocked = false;
    this.x = 0;
    this.y = 0;
    this.$eq = function (b) {
      return (this.isLocked === b.isLocked) && (this.x === b.x) && (this.y === b.y);
    };
    this.$assign = function (s) {
      this.isLocked = s.isLocked;
      this.x = s.x;
      this.y = s.y;
      return this;
    };
  });
  rtl.recNewT(this,"CrossHairRec",function () {
    this.isVisible = false;
    this.x = 0;
    this.y = 0;
    this.$eq = function (b) {
      return (this.isVisible === b.isVisible) && (this.x === b.x) && (this.y === b.y);
    };
    this.$assign = function (s) {
      this.isVisible = s.isVisible;
      this.x = s.x;
      this.y = s.y;
      return this;
    };
  });
  rtl.recNewT(this,"DrawItemRec",function () {
    this.x = 0;
    this.y = 0;
    this.item = 0;
    this.delay = 0;
    this.$eq = function (b) {
      return (this.x === b.x) && (this.y === b.y) && (this.item === b.item) && (this.delay === b.delay);
    };
    this.$assign = function (s) {
      this.x = s.x;
      this.y = s.y;
      this.item = s.item;
      this.delay = s.delay;
      return this;
    };
  });
  this.aitempoints$clone = function (a) {
    var r = [];
    for (var i = 0; i < 1001; i++) r.push($mod.itempoints.$clone(a[i]));
    return r;
  };
  this.aqueuedrawitems$clone = function (a) {
    var r = [];
    for (var i = 0; i < 1000; i++) r.push($mod.DrawItemRec.$clone(a[i]));
    return r;
  };
  rtl.recNewT(this,"DrawQueueRec",function () {
    this.Count = 0;
    this.TickDelay = 0;
    this.Processing = false;
    this.$new = function () {
      var r = Object.create(this);
      r.Queue = rtl.arraySetLength(null,$mod.DrawItemRec,1000);
      return r;
    };
    this.$eq = function (b) {
      return rtl.arrayEq(this.Queue,b.Queue) && (this.Count === b.Count) && (this.TickDelay === b.TickDelay) && (this.Processing === b.Processing);
    };
    this.$assign = function (s) {
      this.Queue = $mod.aqueuedrawitems$clone(s.Queue);
      this.Count = s.Count;
      this.TickDelay = s.TickDelay;
      this.Processing = s.Processing;
      return this;
    };
  });
  rtl.recNewT(this,"scoreRec",function () {
    this.xoff = 0;
    this.yoff = 0;
    this.score = 0;
    this.mx = 0;
    this.pos = 0;
    this.$eq = function (b) {
      return (this.xoff === b.xoff) && (this.yoff === b.yoff) && (this.score === b.score) && (this.mx === b.mx) && (this.pos === b.pos);
    };
    this.$assign = function (s) {
      this.xoff = s.xoff;
      this.yoff = s.yoff;
      this.score = s.score;
      this.mx = s.mx;
      this.pos = s.pos;
      return this;
    };
  });
  rtl.recNewT(this,"helpRec",function () {
    this.xoff = 0;
    this.yoff = 0;
    this.$eq = function (b) {
      return (this.xoff === b.xoff) && (this.yoff === b.yoff);
    };
    this.$assign = function (s) {
      this.xoff = s.xoff;
      this.yoff = s.yoff;
      return this;
    };
  });
  rtl.recNewT(this,"GBPosRec",function () {
    this.xoff = 0;
    this.yoff = 0;
    this.$eq = function (b) {
      return (this.xoff === b.xoff) && (this.yoff === b.yoff);
    };
    this.$assign = function (s) {
      this.xoff = s.xoff;
      this.yoff = s.yoff;
      return this;
    };
  });
  this.GB = rtl.arraySetLength(null,this.GameBoardRec,9,9);
  this.GBPos = this.GBPosRec.$new();
  this.GBItemLock = this.ItemLockRec.$new();
  this.GBCrossHair = this.CrossHairRec.$new();
  this.GBRowsCleared = false;
  this.aiCounter = 0;
  this.GBDraw = this.DrawQueueRec.$new();
  this.score = this.scoreRec.$new();
  this.help = this.helpRec.$new();
  this.cheatmode = false;
  this.gameover = false;
  this.ProcessKeys = function (k) {
    if ($mod.gameover === false) {
      if (k === 75) $impl.MoveCrossHairLeft();
      if (k === 77) $impl.MoveCrossHairRight();
      if (k === 72) $impl.MoveCrossHairUp();
      if (k === 80) $impl.MoveCrossHairDown();
    };
    if (k === 102) {
      $mod.gameover = false;
      $impl.StartGame();
    };
    if (k === 13) $impl.LockOrMove();
    $mod.gameover = $impl.isGameOver();
    if ($mod.gameover) $impl.DrawGameOver();
    if ($mod.cheatmode) $impl.CheatAction(k);
    if (k === 100) {
      $mod.cheatmode = !$mod.cheatmode;
      $impl.DrawHelp();
    };
    if (k === 101) {
      $impl.DrawGameOver();
      $mod.gameover = true;
    };
  };
  this.fivelineInit = function () {
    $impl.InitDrawQueue();
    $impl.StartGame();
  };
  this.DrawQueueProcessTimer = function () {
    var di = $mod.DrawItemRec.$new();
    if (($mod.GBDraw.Processing === false) && ($mod.GBDraw.Count > 0)) {
      $impl.GetQueueDrawItem(di);
      $impl.DrawGameBoardItem(di.x,di.y,di.item);
      $mod.GBDraw.Processing = true;
      $mod.GBDraw.TickDelay = di.delay;
    } else {
      if ($mod.GBDraw.Processing) {
        if ($mod.GBDraw.TickDelay > 0) {
          $mod.GBDraw.TickDelay -= 1;
        } else {
          $mod.GBDraw.Processing = false;
        };
      };
    };
  };
  $mod.$implcode = function () {
    $impl.delay = function (ms) {
    };
    $impl.IntToStr = function (num) {
      var Result = "";
      var TStr = "";
      TStr = "" + num;
      Result = TStr;
      return Result;
    };
    $impl.InitGameBoard = function () {
      var i = 0;
      var j = 0;
      for (j = 0; j <= 8; j++) {
        for (i = 0; i <= 8; i++) {
          $mod.GB[i][j].Item = 0;
        };
      };
    };
    $impl.InitItemLock = function () {
      $mod.GBItemLock.isLocked = false;
      $mod.GBItemLock.x = 0;
      $mod.GBItemLock.y = 0;
    };
    $impl.InitCrossHair = function () {
      $mod.GBCrossHair.x = 4;
      $mod.GBCrossHair.y = 4;
      $mod.GBCrossHair.isVisible = true;
    };
    $impl.InitAiQueue = function () {
      $mod.aiCounter = 0;
    };
    $impl.GB_Bar = function (x, y, x2, y2) {
      pas.graph.Bar(x + $mod.GBPos.xoff,y + $mod.GBPos.yoff,x2 + $mod.GBPos.xoff,y2 + $mod.GBPos.yoff);
    };
    $impl.GB_Rectangle = function (x, y, x2, y2) {
      pas.graph.Rectangle(x + $mod.GBPos.xoff,y + $mod.GBPos.yoff,x2 + $mod.GBPos.xoff,y2 + $mod.GBPos.yoff);
    };
    $impl.GB_Line = function (x, y, x2, y2) {
      pas.graph.Line(x + $mod.GBPos.xoff,y + $mod.GBPos.yoff,x2 + $mod.GBPos.xoff,y2 + $mod.GBPos.yoff);
    };
    $impl.GB_FillEllipse = function (x, y, r1, r2) {
      pas.graph.FillEllipse(x + $mod.GBPos.xoff,y + $mod.GBPos.yoff,r1,r2);
    };
    $impl.DrawFilledRect = function (x, y) {
      $impl.GB_Bar((x * 30) + 1,(y * 30) + 1,((x * 30) + 30) - 1,((y * 30) + 30) - 1);
    };
    $impl.DrawRect = function (x, y, Thick) {
      var i = 0;
      for (var $l = 1, $end = Thick; $l <= $end; $l++) {
        i = $l;
        $impl.GB_Rectangle((x * 30) + i + 1,(y * 30) + i + 1,((x * 30) + 30) - i - 1,((y * 30) + 30) - i - 1);
      };
    };
    $impl.DrawCross = function (x, y, w, h, wthick, hthick) {
      var xoff = 0;
      var yoff = 0;
      var wtoff = 0;
      var htoff = 0;
      xoff = rtl.trunc((30 - w) / 2);
      yoff = rtl.trunc((30 - h) / 2);
      wtoff = rtl.trunc((30 - wthick) / 2);
      htoff = rtl.trunc((30 - hthick) / 2);
      $impl.GB_Bar((x * 30) + xoff,(y * 30) + wtoff,(x * 30) + xoff + w,(y * 30) + wtoff + wthick);
      $impl.GB_Bar((x * 30) + htoff,(y * 30) + yoff,(x * 30) + htoff + hthick,(y * 30) + yoff + h);
    };
    $impl.DrawFillEllip = function (x, y, r) {
      var xoff = 0;
      var yoff = 0;
      xoff = rtl.trunc(30 / 2);
      yoff = rtl.trunc(30 / 2);
      $impl.GB_FillEllipse((x * 30) + xoff,(y * 30) + yoff,r,r);
    };
    $impl.DrawGameBoardItem = function (x, y, item) {
      if (item === 0) {
        pas.graph.SetFillStyle(0,1);
        $impl.DrawFilledRect(x,y);
      } else if (item === 2) {
        pas.graph.SetColor(6);
        $impl.DrawRect(x,y,4);
      } else if (item === 3) {
        pas.graph.SetColor(1);
        $impl.DrawRect(x,y,4);
      } else if (item === 4) {
        pas.graph.SetColor(14);
        $impl.DrawRect(x,y,4);
      } else if (item === 5) {
        pas.graph.SetColor(1);
        $impl.DrawRect(x,y,4);
      } else if (item === 16) {
        pas.graph.SetFillStyle(1,14);
        $impl.DrawFilledRect(x,y);
      } else if (item === 1) {
        pas.graph.SetFillStyle(0,0);
        $impl.DrawCross(x,y,13,13,3,3);
      } else if (item === 10) {
        pas.graph.SetColor(0);
        pas.graph.SetFillStyle(0,4);
        $impl.DrawFillEllip(x,y,10);
      } else if (item === 11) {
        pas.graph.SetColor(0);
        pas.graph.SetFillStyle(0,2);
        $impl.DrawFillEllip(x,y,10);
      } else if (item === 12) {
        pas.graph.SetColor(0);
        pas.graph.SetFillStyle(0,6);
        $impl.DrawFillEllip(x,y,10);
      } else if (item === 13) {
        pas.graph.SetColor(0);
        pas.graph.SetFillStyle(0,3);
        $impl.DrawFillEllip(x,y,10);
      } else if (item === 15) {
        pas.graph.SetColor(0);
        pas.graph.SetFillStyle(0,7);
        $impl.DrawFillEllip(x,y,10);
      } else if (item === 14) {
        pas.graph.SetColor(0);
        pas.graph.SetFillStyle(0,9);
        $impl.DrawFillEllip(x,y,10);
      };
    };
    $impl.InitDrawQueue = function () {
      $mod.GBDraw.Count = 0;
      $mod.GBDraw.Processing = false;
      $mod.GBDraw.TickDelay = 0;
    };
    $impl.QueueDrawItem = function (x, y, item, delay) {
      if ($mod.GBDraw.Count < 1000) {
        $mod.GBDraw.Count += 1;
        $mod.GBDraw.Queue[$mod.GBDraw.Count - 1].x = x;
        $mod.GBDraw.Queue[$mod.GBDraw.Count - 1].y = y;
        $mod.GBDraw.Queue[$mod.GBDraw.Count - 1].item = item;
        $mod.GBDraw.Queue[$mod.GBDraw.Count - 1].delay = delay;
      };
    };
    $impl.GetQueueDrawItem = function (di) {
      var i = 0;
      if ($mod.GBDraw.Count > 0) {
        di.$assign($mod.GBDraw.Queue[0]);
        for (var $l = 2, $end = $mod.GBDraw.Count; $l <= $end; $l++) {
          i = $l;
          $mod.GBDraw.Queue[i - 1 - 1].$assign($mod.GBDraw.Queue[i - 1]);
        };
        $mod.GBDraw.Count -= 1;
      };
    };
    $impl.DrawCrossHair = function () {
      $impl.QueueDrawItem($mod.GBCrossHair.x,$mod.GBCrossHair.y,1,0);
    };
    $impl.DrawLocked = function () {
      if ($mod.GBItemLock.isLocked) {
        $impl.QueueDrawItem($mod.GBItemLock.x,$mod.GBItemLock.y,2,0);
      } else {
        $impl.QueueDrawItem($mod.GBItemLock.x,$mod.GBItemLock.y,3,0);
      };
    };
    $impl.MoveCrossHairLeft = function () {
      if ($mod.GBCrossHair.x > 0) {
        $impl.QueueDrawItem($mod.GBCrossHair.x,$mod.GBCrossHair.y,$mod.GB[$mod.GBCrossHair.x][$mod.GBCrossHair.y].Item,0);
        $mod.GBCrossHair.x -= 1;
        $impl.DrawCrossHair();
      };
    };
    $impl.MoveCrossHairRight = function () {
      if ($mod.GBCrossHair.x < (9 - 1)) {
        $impl.QueueDrawItem($mod.GBCrossHair.x,$mod.GBCrossHair.y,$mod.GB[$mod.GBCrossHair.x][$mod.GBCrossHair.y].Item,0);
        $mod.GBCrossHair.x += 1;
        $impl.DrawCrossHair();
      };
    };
    $impl.MoveCrossHairDown = function () {
      if ($mod.GBCrossHair.y < (9 - 1)) {
        $impl.QueueDrawItem($mod.GBCrossHair.x,$mod.GBCrossHair.y,$mod.GB[$mod.GBCrossHair.x][$mod.GBCrossHair.y].Item,0);
        $mod.GBCrossHair.y += 1;
        $impl.DrawCrossHair();
      };
    };
    $impl.MoveCrossHairUp = function () {
      if ($mod.GBCrossHair.y > 0) {
        $impl.QueueDrawItem($mod.GBCrossHair.x,$mod.GBCrossHair.y,$mod.GB[$mod.GBCrossHair.x][$mod.GBCrossHair.y].Item,0);
        $mod.GBCrossHair.y -= 1;
        $impl.DrawCrossHair();
      };
    };
    $impl.DrawGameGrid = function () {
      var i = 0;
      var j = 0;
      pas.graph.SetFillStyle(0,1);
      $impl.GB_Bar(0,0,9 * 30,9 * 30);
      pas.graph.SetColor(15);
      $impl.GB_Rectangle(0,0,9 * 30,9 * 30);
      for (i = 1; i <= 8; i++) {
        $impl.GB_Line(i * 30,0,i * 30,9 * 30);
      };
      for (j = 1; j <= 8; j++) {
        $impl.GB_Line(0,j * 30,9 * 30,j * 30);
      };
    };
    $impl.DrawGameBoardItems = function () {
      var i = 0;
      var j = 0;
      for (j = 0; j <= 8; j++) {
        for (i = 0; i <= 8; i++) {
          $impl.DrawGameBoardItem(i,j,$mod.GB[i][j].Item);
        };
      };
      $impl.DrawLocked();
      $impl.DrawCrossHair();
    };
    $impl.DrawGameBoard = function () {
      $impl.DrawGameGrid();
      $impl.DrawGameBoardItems();
    };
    $impl.canMoveTo = function (x, y) {
      var Result = false;
      Result = $mod.GB[x][y].Item === 0;
      return Result;
    };
    $impl.MoveGameBoardItem = function (startx, starty, endx, endy) {
      $mod.GB[endx][endy].Item = $mod.GB[startx][starty].Item;
      $mod.GB[startx][starty].Item = 0;
    };
    $impl.isPosInRange = function (x, y) {
      var Result = false;
      var maxx = 0;
      var maxy = 0;
      maxx = 9 - 1;
      maxy = 9 - 1;
      Result = (x >= 0) && (x <= maxx) && (y >= 0) && (y <= maxy);
      return Result;
    };
    $impl.isColorSame = function (TGB, x1, y1, x2, y2) {
      var Result = false;
      var c1 = 0;
      var c2 = 0;
      c1 = TGB.get()[x1][y1].Item;
      c2 = TGB.get()[x2][y2].Item;
      Result = (c1 > 0) && (c1 === c2);
      return Result;
    };
    $impl.FindColorCount = function (TGB, startx, starty, stepx, stepy, count) {
      var Result = 0;
      var i = 0;
      var c = 0;
      var xpos = 0;
      var ypos = 0;
      xpos = startx;
      ypos = starty;
      c = 1;
      for (var $l = 1, $end = count - 1; $l <= $end; $l++) {
        i = $l;
        if ($impl.isPosInRange(xpos,ypos) && $impl.isPosInRange(xpos + stepx,ypos + stepy)) {
          if ($impl.isColorSame(TGB,xpos,ypos,xpos + stepx,ypos + stepy)) {
            c += 1;
          } else {
            Result = c;
            return Result;
          };
        };
        xpos += stepx;
        ypos += stepy;
      };
      Result = c;
      return Result;
    };
    $impl.AddRowsToQueue = function (x, y, stepx, stepy, count, apoints) {
      apoints.get()[$mod.aiCounter].item = $mod.GB[x][y].Item;
      apoints.get()[$mod.aiCounter].x = x;
      apoints.get()[$mod.aiCounter].y = y;
      apoints.get()[$mod.aiCounter].stepx = stepx;
      apoints.get()[$mod.aiCounter].stepy = stepy;
      apoints.get()[$mod.aiCounter].count = count;
      $mod.aiCounter += 1;
    };
    $impl.SetGameBoardPos = function (xpos, ypos) {
      $mod.GBPos.xoff = xpos;
      $mod.GBPos.yoff = ypos;
    };
    $impl.SetGameHelpPos = function (xpos, ypos) {
      $mod.help.xoff = xpos;
      $mod.help.yoff = ypos;
    };
    $impl.SetGameScorePos = function (xpos, ypos) {
      $mod.score.xoff = xpos;
      $mod.score.yoff = ypos;
    };
    $impl.DrawTitle = function () {
      pas.graph.SetTextStyle(1,1,2);
      pas.graph.SetColor(15);
      pas.graph.OutTextXY(10,10,$mod.ProgramName);
      pas.graph.OutTextXY(10,30,"By " + $mod.ProgramAuthor);
      pas.graph.SetTextStyle(1,1,1);
      pas.graph.OutTextXY(10,50,"Released on " + $mod.ProgramReleaseDate);
    };
    $impl.DrawGameOver = function () {
      function TM() {
        pas.graph.SetTextStyle(1,1,2);
        pas.graph.SetColor(14);
        pas.graph.OutTextXY($mod.GBPos.xoff + 65,$mod.GBPos.yoff + 160,"Game Over");
      };
      window.setTimeout(rtl.createSafeCallback(null,TM),1000);
    };
    $impl.DrawHelp = function () {
      var w = 0;
      var h = 0;
      w = 400;
      h = 250;
      pas.graph.SetTextStyle(1,1,1);
      pas.graph.SetColor(14);
      pas.graph.SetFillStyle(0,1);
      pas.graph.Bar($mod.help.xoff,$mod.help.yoff,$mod.help.xoff + w,$mod.help.yoff + h);
      pas.graph.OutTextXY($mod.help.xoff + 10,$mod.help.yoff + 10,"How To Play Fiveline");
      pas.graph.SetColor(15);
      pas.graph.OutTextXY($mod.help.xoff + 10,$mod.help.yoff + 30,"Arrange five or more balls of same");
      pas.graph.OutTextXY($mod.help.xoff + 10,$mod.help.yoff + 44,"color in any direction to remove");
      pas.graph.OutTextXY($mod.help.xoff + 10,$mod.help.yoff + 58,"from board. Each failed attempt ");
      pas.graph.OutTextXY($mod.help.xoff + 10,$mod.help.yoff + 72,"will introduce more balls to the");
      pas.graph.OutTextXY($mod.help.xoff + 10,$mod.help.yoff + 86,"board. Use arrow keys and Enter");
      pas.graph.OutTextXY($mod.help.xoff + 10,$mod.help.yoff + 100,"key to select your ball. Move ");
      pas.graph.OutTextXY($mod.help.xoff + 10,$mod.help.yoff + 114,"crosshair to an empty location and");
      pas.graph.OutTextXY($mod.help.xoff + 10,$mod.help.yoff + 128,"press ENTER to move your ball.");
      pas.graph.OutTextXY($mod.help.xoff + 10,$mod.help.yoff + 142,"Only balls with a valid path can");
      pas.graph.OutTextXY($mod.help.xoff + 10,$mod.help.yoff + 156,"be moved!");
      pas.graph.SetColor(14);
      pas.graph.OutTextXY($mod.help.xoff + 10,$mod.help.yoff + 176,"R = Restart Game");
      pas.graph.OutTextXY($mod.help.xoff + 10,$mod.help.yoff + 196,"X or Q = QUIT");
      pas.graph.OutTextXY($mod.help.xoff + 10,$mod.help.yoff + 216,"C = Enable\/Disable cheat mode");
      if ($mod.cheatmode) {
        pas.graph.SetColor(2);
        pas.graph.OutTextXY($mod.help.xoff + 10,$mod.help.yoff + 230,"Keys 0 1 2 3 4 5 6 are Enabled");
      };
    };
    $impl.DisplayScore = function (justscore) {
      var w = 0;
      var h = 0;
      w = 400;
      h = 70;
      pas.graph.SetColor(15);
      pas.graph.SetFillStyle(0,1);
      if (justscore === false) {
        pas.graph.Bar($mod.score.xoff,$mod.score.yoff,$mod.score.xoff + w,$mod.score.yoff + h);
        pas.graph.SetTextStyle(1,1,2);
        pas.graph.OutTextXY($mod.score.xoff + 10,$mod.score.yoff + 8,"SCORE:");
      };
      pas.graph.SetFillStyle(0,1);
      pas.graph.Bar($mod.score.xoff,$mod.score.yoff + 28,$mod.score.xoff + w,$mod.score.yoff + h);
      pas.graph.SetTextStyle(1,1,2);
      pas.graph.OutTextXY($mod.score.xoff + 10,$mod.score.yoff + 30,$impl.IntToStr($mod.score.score));
      pas.graph.SetColor(14);
      pas.graph.OutTextXY($mod.score.xoff + 10,$mod.score.yoff + 50,$impl.IntToStr($mod.score.pos) + "x" + $impl.IntToStr($mod.score.mx));
    };
    $impl.UpdateScore = function (pos, count) {
      function TM() {
        $mod.score.pos = pos;
        $mod.score.mx = Math.abs(4 - count) * 10;
        $mod.score.score += $mod.score.mx;
        $impl.DisplayScore(true);
      };
      window.setTimeout(rtl.createSafeCallback(null,TM),pos * 300);
    };
    $impl.DrawRowBoarder = function (x, y, stepx, stepy, count, item) {
      var i = 0;
      for (var $l = 1, $end = count; $l <= $end; $l++) {
        i = $l;
        $impl.QueueDrawItem(x,y,item,10);
        x += stepx;
        y += stepy;
        if (item === 0) $impl.UpdateScore(i,count);
      };
    };
    $impl.DrawRowOfColors = function (apoints, item) {
      var i = 0;
      for (var $l = 0, $end = $mod.aiCounter - 1; $l <= $end; $l++) {
        i = $l;
        $impl.DrawRowBoarder(apoints.get()[i].x,apoints.get()[i].y,apoints.get()[i].stepx,apoints.get()[i].stepy,apoints.get()[i].count,item);
      };
    };
    $impl.DeleteRowFromBoard = function (TGB, x, y, stepx, stepy, count) {
      var i = 0;
      for (var $l = 1, $end = count; $l <= $end; $l++) {
        i = $l;
        TGB.get()[x][y].Item = 0;
        x += stepx;
        y += stepy;
      };
    };
    $impl.copygbtotgb = function (SGB, TGB) {
      var i = 0;
      var j = 0;
      for (j = 0; j <= 8; j++) {
        for (i = 0; i <= 8; i++) {
          TGB.get()[i][j].$assign(SGB.get()[i][j]);
        };
      };
    };
    $impl.FindRowOfColors = function (apoints) {
      var Result = 0;
      var TGB = rtl.arraySetLength(null,$mod.GameBoardRec,9,9);
      var i = 0;
      var j = 0;
      var count = 0;
      var rowcount = 0;
      rowcount = 0;
      $impl.copygbtotgb({p: $mod, get: function () {
          return this.p.GB;
        }, set: function (v) {
          this.p.GB = v;
        }},{get: function () {
          return TGB;
        }, set: function (v) {
          TGB = v;
        }});
      for (j = 0; j <= 8; j++) {
        for (i = 0; i <= 4; i++) {
          count = $impl.FindColorCount({get: function () {
              return TGB;
            }, set: function (v) {
              TGB = v;
            }},i,j,1,0,9);
          if (count > 4) {
            rowcount += 1;
            $impl.AddRowsToQueue(i,j,1,0,count,apoints);
            $impl.DeleteRowFromBoard({get: function () {
                return TGB;
              }, set: function (v) {
                TGB = v;
              }},i,j,1,0,count);
          };
        };
      };
      $impl.copygbtotgb({p: $mod, get: function () {
          return this.p.GB;
        }, set: function (v) {
          this.p.GB = v;
        }},{get: function () {
          return TGB;
        }, set: function (v) {
          TGB = v;
        }});
      for (i = 0; i <= 8; i++) {
        for (j = 0; j <= 4; j++) {
          count = $impl.FindColorCount({get: function () {
              return TGB;
            }, set: function (v) {
              TGB = v;
            }},i,j,0,1,9);
          if (count > 4) {
            rowcount += 1;
            $impl.AddRowsToQueue(i,j,0,1,count,apoints);
            $impl.DeleteRowFromBoard({get: function () {
                return TGB;
              }, set: function (v) {
                TGB = v;
              }},i,j,0,1,count);
          };
        };
      };
      $impl.copygbtotgb({p: $mod, get: function () {
          return this.p.GB;
        }, set: function (v) {
          this.p.GB = v;
        }},{get: function () {
          return TGB;
        }, set: function (v) {
          TGB = v;
        }});
      for (j = 0; j <= 4; j++) {
        for (i = 0; i <= 4; i++) {
          count = $impl.FindColorCount({get: function () {
              return TGB;
            }, set: function (v) {
              TGB = v;
            }},i,j,1,1,9);
          if (count > 4) {
            rowcount += 1;
            $impl.AddRowsToQueue(i,j,1,1,count,apoints);
            $impl.DeleteRowFromBoard({get: function () {
                return TGB;
              }, set: function (v) {
                TGB = v;
              }},i,j,1,1,count);
          };
        };
      };
      $impl.copygbtotgb({p: $mod, get: function () {
          return this.p.GB;
        }, set: function (v) {
          this.p.GB = v;
        }},{get: function () {
          return TGB;
        }, set: function (v) {
          TGB = v;
        }});
      for (j = 0; j <= 4; j++) {
        for (i = 4; i <= 8; i++) {
          count = $impl.FindColorCount({get: function () {
              return TGB;
            }, set: function (v) {
              TGB = v;
            }},i,j,-1,1,9);
          if (count > 4) {
            rowcount += 1;
            $impl.AddRowsToQueue(i,j,-1,1,count,apoints);
            $impl.DeleteRowFromBoard({get: function () {
                return TGB;
              }, set: function (v) {
                TGB = v;
              }},i,j,-1,1,count);
          };
        };
      };
      Result = rowcount;
      return Result;
    };
    $impl.ValidMovesLeft = function () {
      var Result = 0;
      var count = 0;
      var i = 0;
      var j = 0;
      count = 0;
      for (j = 0; j <= 8; j++) {
        for (i = 0; i <= 8; i++) {
          if ($mod.GB[i][j].Item === 0) count += 1;
        };
      };
      Result = count;
      return Result;
    };
    $impl.isGameOver = function () {
      var Result = false;
      Result = $impl.ValidMovesLeft() === 0;
      return Result;
    };
    $impl.GetXYForMoveX = function (mvx, x, y) {
      var i = 0;
      var j = 0;
      var count = 0;
      count = 0;
      x.set(-1);
      y.set(-1);
      for (j = 0; j <= 8; j++) {
        for (i = 0; i <= 8; i++) {
          if ($mod.GB[i][j].Item === 0) count += 1;
          if (count === mvx) {
            x.set(i);
            y.set(j);
            return;
          };
        };
      };
    };
    $impl.GetRandomSpot = function (x, y) {
      var r = 0;
      var vcount = 0;
      x.set(-1);
      y.set(-1);
      vcount = $impl.ValidMovesLeft();
      if (vcount > 0) {
        r = pas.System.Random(vcount) + 1;
        $impl.GetXYForMoveX(r,x,y);
      };
    };
    $impl.GetRandomItem = function () {
      var Result = 0;
      Result = pas.System.Random(6) + 10;
      return Result;
    };
    $impl.PlotItem = function (item) {
      $mod.GB[$mod.GBCrossHair.x][$mod.GBCrossHair.y].Item = item;
      $impl.DrawGameBoardItem($mod.GBCrossHair.x,$mod.GBCrossHair.y,item);
      $impl.DrawCrossHair();
    };
    $impl.LockItem = function () {
      if ($mod.GB[$mod.GBCrossHair.x][$mod.GBCrossHair.y].Item !== 0) {
        if ($mod.GBItemLock.isLocked) {
          $mod.GBItemLock.isLocked = false;
          $impl.DrawLocked();
        };
        $mod.GBItemLock.x = $mod.GBCrossHair.x;
        $mod.GBItemLock.y = $mod.GBCrossHair.y;
        $mod.GBItemLock.isLocked = true;
        $impl.DrawLocked();
      };
    };
    $impl.CopyGbToPga = function (PGrid) {
      var i = 0;
      var j = 0;
      for (j = 0; j <= 8; j++) {
        for (i = 0; i <= 8; i++) {
          if ($mod.GB[i][j].Item !== 0) pas.PathFind.PlaceWall(PGrid,i,j);
        };
      };
    };
    $impl.isPathToItem = function (sx, sy, tx, ty) {
      var Result = false;
      var PGrid = rtl.arraySetLength(null,0,9,9);
      var FoundPath = pas.squeue.SimpleQueueRec.$new();
      pas.PathFind.ClearGrid({get: function () {
          return PGrid;
        }, set: function (v) {
          PGrid = v;
        }});
      $impl.CopyGbToPga({get: function () {
          return PGrid;
        }, set: function (v) {
          PGrid = v;
        }});
      Result = pas.PathFind.FindTargetPath({get: function () {
          return PGrid;
        }, set: function (v) {
          PGrid = v;
        }},sx,sy,tx,ty,FoundPath);
      return Result;
    };
    $impl.isNextToMoveBlock = function (sx, sy, tx, ty) {
      var Result = false;
      var vpos = false;
      var dx = 0;
      var dy = 0;
      Result = false;
      vpos = $impl.isPosInRange(sx,sy) && $impl.isPosInRange(tx,ty);
      if (vpos === false) return Result;
      dx = Math.abs(sx - tx);
      dy = Math.abs(sy - ty);
      Result = ((dx === 1) && (dy === 0)) || ((dx === 0) && (dy === 1));
      return Result;
    };
    $impl.RemoveRows = function (apoints, count) {
      var i = 0;
      for (var $l = 0, $end = count - 1; $l <= $end; $l++) {
        i = $l;
        $impl.DeleteRowFromBoard({p: $mod, get: function () {
            return this.p.GB;
          }, set: function (v) {
            this.p.GB = v;
          }},apoints.get()[i].x,apoints.get()[i].y,apoints.get()[i].stepx,apoints.get()[i].stepy,apoints.get()[i].count);
      };
      $impl.DrawRowOfColors(apoints,0);
    };
    $impl.SetRowsClearedStatus = function (status) {
      $mod.GBRowsCleared = status;
    };
    $impl.GetRowsClearedStatus = function () {
      var Result = false;
      Result = $mod.GBRowsCleared;
      return Result;
    };
    $impl.CheckForRows = function () {
      var count = 0;
      var apoints = rtl.arraySetLength(null,$mod.itempoints,1001);
      $impl.SetRowsClearedStatus(false);
      $impl.InitAiQueue();
      count = $impl.FindRowOfColors({get: function () {
          return apoints;
        }, set: function (v) {
          apoints = v;
        }});
      if (count > 0) {
        $impl.DrawRowOfColors({get: function () {
            return apoints;
          }, set: function (v) {
            apoints = v;
          }},4);
        $impl.RemoveRows({get: function () {
            return apoints;
          }, set: function (v) {
            apoints = v;
          }},count);
        $impl.SetRowsClearedStatus(true);
      };
    };
    $impl.AniMoveBoardItem = function (sx, sy, tx, ty) {
      var PGrid = rtl.arraySetLength(null,0,9,9);
      var FoundPath = pas.squeue.SimpleQueueRec.$new();
      var qr = pas.squeue.LocationRec.$new();
      var i = 0;
      var item = 0;
      var isPathToItem = false;
      pas.PathFind.ClearGrid({get: function () {
          return PGrid;
        }, set: function (v) {
          PGrid = v;
        }});
      $impl.CopyGbToPga({get: function () {
          return PGrid;
        }, set: function (v) {
          PGrid = v;
        }});
      pas.squeue.InitSQueue(FoundPath);
      isPathToItem = pas.PathFind.FindTargetPath({get: function () {
          return PGrid;
        }, set: function (v) {
          PGrid = v;
        }},sx,sy,tx,ty,FoundPath);
      if (isPathToItem === false) return;
      item = $mod.GB[sx][sy].Item;
      for (var $l = 1, $end = pas.squeue.SQueueCount(FoundPath); $l <= $end; $l++) {
        i = $l;
        pas.squeue.SQueueGet(FoundPath,i,qr);
        $impl.QueueDrawItem(qr.x,qr.y,16,10);
        $impl.delay(500);
      };
      $impl.QueueDrawItem(sx,sy,0,10);
      for (var $l1 = 1, $end1 = pas.squeue.SQueueCount(FoundPath); $l1 <= $end1; $l1++) {
        i = $l1;
        pas.squeue.SQueueGet(FoundPath,i,qr);
        $impl.QueueDrawItem(qr.x,qr.y,item,10);
        $impl.delay(500);
        $impl.QueueDrawItem(qr.x,qr.y,16,5);
      };
      $impl.QueueDrawItem(tx,ty,item,10);
      for (var $l2 = 1, $end2 = pas.squeue.SQueueCount(FoundPath); $l2 <= $end2; $l2++) {
        i = $l2;
        pas.squeue.SQueueGet(FoundPath,i,qr);
        $impl.QueueDrawItem(qr.x,qr.y,0,10);
        $impl.delay(500);
      };
    };
    $impl.MovedItem = function () {
      var Result = false;
      var canMove = false;
      var pathMove = false;
      var nextMove = false;
      Result = false;
      canMove = false;
      canMove = $mod.GBItemLock.isLocked && $impl.canMoveTo($mod.GBCrossHair.x,$mod.GBCrossHair.y);
      if (canMove === false) return Result;
      nextMove = $impl.isNextToMoveBlock($mod.GBItemLock.x,$mod.GBItemLock.y,$mod.GBCrossHair.x,$mod.GBCrossHair.y);
      if (nextMove === false) {
        pathMove = $impl.isPathToItem($mod.GBItemLock.x,$mod.GBItemLock.y,$mod.GBCrossHair.x,$mod.GBCrossHair.y);
        if (pathMove === false) return Result;
      };
      $mod.GBItemLock.isLocked = false;
      $impl.DrawLocked();
      if (pathMove) $impl.AniMoveBoardItem($mod.GBItemLock.x,$mod.GBItemLock.y,$mod.GBCrossHair.x,$mod.GBCrossHair.y);
      $impl.MoveGameBoardItem($mod.GBItemLock.x,$mod.GBItemLock.y,$mod.GBCrossHair.x,$mod.GBCrossHair.y);
      $mod.GBItemLock.isLocked = false;
      $impl.QueueDrawItem($mod.GBItemLock.x,$mod.GBItemLock.y,$mod.GB[$mod.GBItemLock.x][$mod.GBItemLock.y].Item,0);
      $impl.QueueDrawItem($mod.GBCrossHair.x,$mod.GBCrossHair.y,$mod.GB[$mod.GBCrossHair.x][$mod.GBCrossHair.y].Item,0);
      $impl.CheckForRows();
      $impl.DrawCrossHair();
      Result = true;
      return Result;
    };
    $impl.ComputerMove = function () {
      var item = 0;
      var x = 0;
      var y = 0;
      var i = 0;
      var count = 0;
      count = $impl.ValidMovesLeft();
      if (count > 3) count = 3;
      for (var $l = 1, $end = count; $l <= $end; $l++) {
        i = $l;
        $impl.GetRandomSpot({get: function () {
            return x;
          }, set: function (v) {
            x = v;
          }},{get: function () {
            return y;
          }, set: function (v) {
            y = v;
          }});
        item = $impl.GetRandomItem();
        $mod.GB[x][y].Item = item;
        $impl.QueueDrawItem(x,y,item,10);
        $impl.delay(1200);
      };
    };
    $impl.CheatAction = function (k) {
      if (k === 104) $impl.PlotItem(10);
      if (k === 105) $impl.PlotItem(11);
      if (k === 106) $impl.PlotItem(12);
      if (k === 107) $impl.PlotItem(13);
      if (k === 108) $impl.PlotItem(14);
      if (k === 109) $impl.PlotItem(15);
      if (k === 103) $impl.PlotItem(0);
    };
    $impl.LockOrMove = function () {
      if ($mod.GBItemLock.isLocked) {
        if ($mod.GB[$mod.GBCrossHair.x][$mod.GBCrossHair.y].Item !== 0) {
          $impl.LockItem();
        } else {
          if ($impl.MovedItem()) {
            if ($impl.GetRowsClearedStatus() === false) {
              $impl.ComputerMove();
              $impl.CheckForRows();
              $impl.DrawCrossHair();
            };
          };
        };
      } else {
        $impl.LockItem();
      };
    };
    $impl.InitScore = function () {
      $mod.score.score = 0;
      $mod.score.mx = 0;
      $mod.score.pos = 0;
    };
    $impl.StartGame = function () {
      $mod.cheatmode = false;
      $mod.gameover = false;
      $impl.InitScore();
      $impl.SetGameBoardPos(30,70);
      $impl.SetGameHelpPos(330,90);
      $impl.SetGameScorePos(330,10);
      $impl.DrawTitle();
      $impl.DisplayScore(false);
      $impl.InitAiQueue();
      $impl.InitGameBoard();
      $impl.InitItemLock();
      $impl.InitCrossHair();
      $impl.DrawGameBoard();
      $impl.DrawHelp();
      $impl.ComputerMove();
      $impl.DrawCrossHair();
    };
  };
  $mod.$init = function () {
  };
},[]);
rtl.module("program",["System","Web","p2jsres","graph","palette","bitfonts","fiveline"],function () {
  "use strict";
  var $mod = this;
  this.timer_id = 0;
  this.InitGame = function () {
    pas.fiveline.fivelineInit();
  };
  this.HandleKeyDown = function (k) {
    var Result = false;
    if (k.code === pas.Web.TJSKeyNames.ArrowLeft) pas.fiveline.ProcessKeys(75);
    if (k.code === pas.Web.TJSKeyNames.ArrowRight) pas.fiveline.ProcessKeys(77);
    if (k.code === pas.Web.TJSKeyNames.ArrowDown) pas.fiveline.ProcessKeys(80);
    if (k.code === pas.Web.TJSKeyNames.ArrowUp) pas.fiveline.ProcessKeys(72);
    if (k.code === pas.Web.TJSKeyNames.Enter) pas.fiveline.ProcessKeys(13);
    if (k.code === "KeyL") pas.fiveline.ProcessKeys(13);
    if (k.code === "KeyR") pas.fiveline.ProcessKeys(102);
    if (k.code === "KeyC") pas.fiveline.ProcessKeys(100);
    if ((k.code === "KeyQ") || (k.code === "KeyX")) {
      window.open("https:\/\/github.com\/RetroNick2020","_self");
    };
    if (k.key === "0") pas.fiveline.ProcessKeys(103);
    if (k.key === "1") pas.fiveline.ProcessKeys(104);
    if (k.key === "2") pas.fiveline.ProcessKeys(105);
    if (k.key === "3") pas.fiveline.ProcessKeys(106);
    if (k.key === "4") pas.fiveline.ProcessKeys(107);
    if (k.key === "5") pas.fiveline.ProcessKeys(108);
    if (k.key === "6") pas.fiveline.ProcessKeys(109);
    return Result;
  };
  $mod.$main = function () {
    pas.p2jsres.SetResourceSource(pas.p2jsres.TResourceSource.rsHTML);
    pas.graph.InitGraph(9,2,"");
    pas.bitfonts.SetBitFontPixelProc(pas.graph.BitFontPutPixel);
    pas.graph.SetTextStyle(1,1,2);
    $mod.InitGame();
    document.onkeydown = rtl.createSafeCallback($mod,"HandleKeyDown");
    $mod.timer_id = window.setInterval(rtl.createSafeCallback(pas.fiveline,"DrawQueueProcessTimer"),10);
  };
});
