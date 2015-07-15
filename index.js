var websocket = require("websocket").server;
var http = require("http");
var port = process.env.PORT || 5000;

var httpServer = http.createServer(function(request, response){
    response.end("<script>location.replace('http://gmartigny.github.com/socket-cats');</script>");
});
httpServer.listen(port);

var websocketServer = new websocket({
    httpServer: httpServer
});

websocketServer.on("request", function(request){
    new MyConnection(request);
});

// connection object
function MyConnection(request){
    this.time = Date.now();
    this.connection = request.accept(null, request.origin);
    this.user = false;
    
    this.emit({
        type: "list",
        value: this.everyone()
    });
    var self = this;
    this.connection.on("message", function(d){
        self.message.call(self, d);
    });
    this.connection.on("close", function(){
        self.close.call(self);
    });
    this.nb = MyConnection.list.insert(this);
}
// get a message
MyConnection.prototype.message = function(data){
    if(data.type === 'utf8'){
        var infos = JSON.parse(data.utf8Data);
        
        if(infos.type == "handshake"){
            var u = new MyUser(infos.value.nick, infos.value.color),
                exists = false;
            
            MyConnection.list.every(function(c){
                if(c.user && u.equals(c.user)){
                    exists = true;
                    return false;
                }
                else
                    return true;
            });
            
            if(exists){
                this.emit({
                    type: "hs-taken",
                    value: ""
                });
            }
            else{
                this.setUser(u);
                this.emit({
                    type: "hs-isok",
                    value: u.minify()
                });
                this.broadcast({
                    type: "arrive",
                    value: u.minify()
                });
            }
        }
        else if(infos.type == "message"){
            if(this.user){
                this.broadcast({
                    type: "message",
                    value: infos.value
                });
            }
        }
    }
};
MyConnection.prototype.setUser = function(u){
    this.user = u;
    MyConnection.list[this.nb].user = u;
};
// send to everyone else
MyConnection.prototype.broadcast = function(o){
    var self = this;
    MyConnection.list.forEach(function(c){
        if(c.user !== self.user)
            c.emit(o);
    });
};
// send something
MyConnection.prototype.emit = function(o){
    this.connection.sendUTF(JSON.stringify(o));
};
// close connection
MyConnection.prototype.close = function(){
    if(this.user){
        this.broadcast({
            type: "leave",
            value: this.user.minify()
        });
    }
    MyConnection.list[this.nb] = undefined;
    
    for(var i=MyConnection.list.length-1;i;--i){
        if(MyConnection.list[i] === undefined)
            MyConnection.list.pop();
        else
            break;
    }
};
MyConnection.prototype.everyone = function(){
    var all = [];
    
    MyConnection.list.forEach(function(c){
        if(c.user)
            all.push(c.user.minify());
    });
    
    return all;
};
MyConnection.list = [];

// user object
function MyUser(nick, color){
    this.nick = nick;
    this.color = color;
}
MyUser.prototype.minify = function(){
    return {
        nick: this.nick,
        color: this.color
    };
};
// users comparison
MyUser.prototype.equals = function(o){
    if(o && this.nick == o.nick && this.color == o.color)
        return true;
    return false;
};

Array.prototype.insert = function(o){
    for(var i=0;i<=this.length;++i){
        if(this[i] === undefined){
            this[i] = o;
            return i;
        }
    }
};