#!/usr/bin/python
#
# A Python wrapper around the Teleportd API.

__author__ = 'Antoine Llorca <antoine@teleportd.com>'
__version__ = '0.3.2'

import urllib
import urllib2
import urlparse
import pycurl

try:
	# Python >= 2.6
	import json as simplejson
except ImportError:
	try:
		# Python < 2.6
		import simplejson
	except ImportError:
		try:
			# Google App Engine
			from django.utils import simplejson
		except ImportError:
			raise ImportError, 'Unable to load a JSON library'

class TeleportdError(Exception):
	'''Class handling Teleportd errors'''
	def __init__(self, msg):
		self.msg = msg
	
	def __str__(self):
		return repr(self.msg)

class Teleportd():
	'''Class wrapping the Teleportd API'''
	def __init__(self, key, url='http://api.v2.teleportd.com/%s?user_key=%s&%s', port='80'):
		self.key = key
		self.url = url
		self.port = port
		self.buffer = ''
	
	def search(self, args):
		'''Performs a search.
		
		Args:
			args:
				An array of search arguments
		
		Returns:
			A JSON object containing the search results
		'''
		return self.__request('search', args)
		
	def get(self, sha):
		'''Gets a picture.
		
		Args:
			sha:
				The SHA identifier of the picture
		
		Returns:
			A JSON object describing the picture
		'''
		return self.__request('get', sha)
	
	def stream(self, args, callback):
		return self.__request('stream', args, callback)
	
	def __on_receive(self, chunk, callback):
		self.buffer += chunk
		data = self.buffer.split('\r\n')
		if self.buffer.endswith('\r\n'):
			for obj in data:
				callback(simplejson.loads(simplejson.dumps(obj)))
			self.buffer = ''
		else:
			self.buffer = data[-1]
			del data[-1]
			for obj in data:
				callback(simplejson.loads(simplejson.dumps(obj)))
	
	def __request(self, endpoint, args, callback=None):
		'''Executes a GET request to the servers with
		   the provided endpoint and args
		
		Args:
			endpoint:
				The API endpoint (e.g. 'search', 'stream', 'get'...)
			args:
				An array of search arguments
		
		Returns:
			The JSON corresponding to the request
		'''
		url = self.url % (endpoint, self.key, urllib.urlencode(args))
		if endpoint is 'stream':
			conn = pycurl.Curl()
			conn.setopt(pycurl.VERBOSE, 1)
			conn.setopt(pycurl.URL, url)
			conn.setopt(pycurl.WRITEFUNCTION, lambda chunk: self.__on_receive(chunk, callback))
			conn.perform()
		else:
			response = urllib2.urlopen(url).read()
			data = simplejson.loads(response)
			return data
			