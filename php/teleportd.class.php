<?
// Copyright Teleportd Ltd
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

define('TELEPORTD_SRV', 'api.teleportd.com');
define('TELEPORTD_PORT', 80);

/**********************************************/
// TELEPORTD EXCEPTION
class TeleportdException extends Exception {}

/**********************************************/
// TELEPORTD CLASS
class Teleportd
{
  public $user_key;
  public $srv;
  public $port;


  public function __construct($user_key, $srv = null, $port = null)
  {
    $this->user_key = $user_key;

    if($srv)
      {
        $this->srv = $srv;
      }
    elseif(defined('TELEPORTD_SRV'))
      {
        $this->srv = TELEPORTD_SRV;
      }

    if($port)
      {
        $this->port = $port;
      }
    elseif(defined('TELEPORTD_PORT'))
      {
        $this->port = TELEPORTD_PORT;
      }
  }


  /**
   * @param args an array of arguments (str, loc, period)
   *        example: array('str' => 'paris',
   *                       'loc' => array(42.3, 2.5, 4, 4))
   */
  public function search($args)
  {
    return $this->__execute('search', $args)->hits;
  }

  /**
   * @param sha the sha of the picture to get
   */
  public function get($sha)
  {
    return $this->__execute('get', array('sha' => $sha))->hit;
  }


  /**
   * executes a GET query to the servers with the provided
   * method and args
   * @param method the method to call
   * @param args an array of arguments
   */
  protected function __execute($method, $args)
  {
    $data = false;
    $path = '/'.$method.'?user_key='.$this->user_key.'&'.http_build_query($args);      
   
    $fp = @fsockopen($this->srv, $this->port, $errno, $errstr, 1);

    if ($fp)
      {
        stream_set_timeout($fp, 1);
        $out = "GET ".$path." HTTP/1.0\r\n";
        $out .= "Host: ".$this->srv."\r\n";
        $out .= "Accept: */*\r\n";
        $out .= "Connection: Close\r\n";
        $out .= "Pragma: no-cache\r\n";
        $out .= "Cache-Control: no-cache\r\n";
        $out .= "\r\n";

        if (fwrite($fp, $out))
          {
            $hdrs = "";
            $body = "";
            $switch = false;
            while (!feof($fp)) {
              $data = true;
              $line = fgets($fp, 128);
              if(!$switch)
                {
                  if ($line == "\r\n")
                    $switch = true;
                  else
                    $hdrs.=$line;
                }
              else
                $body.=$line;
            }
            fclose ($fp);
          }
      }

    if (!$data)
      {
        throw new TeleportdException('Connection failed');
      }
    else
      {
        print('<br/>test<br/>');
        print_r($body);
        $json = json_decode(mb_convert_encoding($body, 'UTF-8'));

        if($json)
          {
            if($json->ok) 
              {
                return $json;
              }
            else
              {
                throw new TeleportdException($json->error);
              }
          }
        else
          {
            throw new TeleportdException('Parsing failed');
          }
      }
  }

}

?>
