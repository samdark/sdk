============================
Teleportd API Python Wrapper
============================

The Teleportd API for Python is a Python wrapper around the
Teleportd API that makes it very simple to build Python apps
on top of the Teleportd API.
For more information on how the API works, a full
documentation is available `here <http://teleportd.com/api>`_.

Typical usage looks like this::

		#!/usr/bin/env python
		
		from teleportd import teleportd

		teleportd = teleportd.Teleportd('_YOUR_USER_KEY_')
		
		# Search with filters as a dictionary
		search = teleportd.search({'str': 'laduree'})
		
		# Retrieve a picture with the corresponding sha
		get = teleportd.get({'sha': '12-07-20-98a3b3fdd9b190ef4484a06a76fc1009c03076c5'})
		
		# Callback for each object fetched from the stream
		def callback(data):
			do_something(data)
		
		# Real-time photo stream
		stream = teleportd.stream({}, callback)


License
=======

This wrapper is released under the MIT license.
