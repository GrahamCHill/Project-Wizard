require 'optparse'

name = 'World'
OptionParser.new do |parser|
  parser.banner = 'Usage: ruby main.rb [--name NAME]'
  parser.on('--name NAME', 'Name to greet') { |value| name = value }
end.parse!

puts "Hello, #{name}, from __PROJECT_NAME__!"
