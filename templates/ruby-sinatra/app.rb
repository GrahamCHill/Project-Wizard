require 'json'
require 'sinatra'

set :bind, '127.0.0.1'
set :port, 8080
set :server, 'webrick'

get '/' do
  content_type :json
  JSON.generate(message: 'Hello from __PROJECT_NAME__!')
end
