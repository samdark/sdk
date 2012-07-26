#!/usr/bin/python

from teleportd import Teleportd

teleportd = Teleportd('_YOUR_USER_KEY_')

def callback(data):
	print data

#stream = teleportd.stream({}, callback)
search = teleportd.search({'str': 'paris'})
#get = teleportd.get({'sha': '12-07-20-98a3b3fdd9b190ef4484a06a76fc1009c03076c5'})

print search