using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml;
using System.IO;
using System.Net;

namespace DirectoryHandling
{
    /// <summary>
    /// This is a utility class. It provides functions to pretty-print
    /// the response received from Media Sequencer Engine and extracting
    /// self uri from the response in order to use it in delete operation.
    /// </summary>
    internal class Util
    {
        private static XmlNamespaceManager nameSpaceManager_;

        static Util()
        {
            nameSpaceManager_ = new XmlNamespaceManager(new NameTable());
            nameSpaceManager_.AddNamespace("viz", "http://www.vizrt.com/atom");
            nameSpaceManager_.AddNamespace("atom", "http://www.w3.org/2005/Atom");
            nameSpaceManager_.AddNamespace("vdf", "http://www.vizrt.com/types");
            nameSpaceManager_.AddNamespace("app", "http://www.w3.org/2007/app");
            nameSpaceManager_.AddNamespace("vaext", "http://www.vizrt.com/atom-ext");
        }

        private static string FormatXml(string xml)
        {
            try
            {
                var doc = new XmlDocument();
                doc.LoadXml(xml);

                var sw = new StringWriter();
                var tx = new XmlTextWriter(sw);
                tx.Formatting = Formatting.Indented;
                doc.WriteTo(tx);

                return sw.ToString();
            }
            catch (XmlException)
            {
                return xml;
            }
        }

        internal static string GetResponseBody(HttpWebResponse res)
        {
            var receiveStream = res.GetResponseStream();
            var encode = System.Text.Encoding.GetEncoding("utf-8");
            var readStream = new StreamReader(receiveStream, encode);
            var builder = new StringBuilder();
            var read = new Char[256];
            var count = readStream.Read(read, 0, 256);
            while (count > 0)
            {
                builder.Append(read, 0, count);
                count = readStream.Read(read, 0, 256);
            }

            return FormatXml(builder.ToString());
        }

        internal static void PrintHttpWebResponse(HttpWebResponse res, string body)
        {
            Console.WriteLine();
            Console.WriteLine("Reply:");
            Console.WriteLine();
            Console.WriteLine("HTTP/" + res.ProtocolVersion + " "
                + (int)res.StatusCode + " " + res.StatusCode);
            Console.WriteLine(res.Headers);
            Console.WriteLine(FormatXml(body));
            Console.WriteLine();
        }

        private static string GetValueFromDocumentByXPath(XmlDocument doc, string xpath)
        {
            var nav = doc.CreateNavigator();
            var it = nav.Select(xpath, nameSpaceManager_);
            if (it.MoveNext())
            {
                return it.Current.Value;
            }

            return "";
        }

        internal static string GetSelfUri(string responseBody)
        {
            var doc = new XmlDocument();
            doc.LoadXml(responseBody);
            return GetValueFromDocumentByXPath(doc,
                "//atom:entry/atom:link[@rel='self']/@href");
        }
    }

    // --------------------------------------------------------------------

    class DirectoryHandlingExample
    {
        public string CreateDirectory()
        {
            HttpWebResponse response;

            try
            {
                // Create a connection to the URI that we want to create
                // a directory under it.
                var client = (HttpWebRequest)WebRequest.Create(
                    "http://127.0.0.1:8580/directory/playlists/");

                byte[] bodyBytes = Encoding.UTF8.GetBytes(@"
                    <entry xmlns=""http://www.w3.org/2005/Atom"" xmlns:viz=""http://www.vizrt.com/atom"">
                        <category term=""directory"" scheme=""http://www.vizrt.com/types""/>
                        <title>OldPlaylists</title>
                        <author>
                        <name>Media Sequencer Engine</name>
                        </author>
                        <updated>2009-10-14T10:56:54Z</updated>
                        <id>tag:MSE1,2009-10-14,0:/directory/playlists/OldPlaylists</id>
                        <summary>Directory OldPlaylists</summary>
                    </entry>");

                client.Method = "POST";
                client.ContentType = "application/atom+xml;type=entry";
                client.ContentLength = bodyBytes.Length;
                client.GetRequestStream().Write(bodyBytes, 0, bodyBytes.Length);

                response = (HttpWebResponse)client.GetResponse();
            }
            catch (WebException e)
            {
                response = (HttpWebResponse)e.Response;
            }

            var responseBody = Util.GetResponseBody(response);
            var selfUri = Util.GetSelfUri(responseBody);

            Util.PrintHttpWebResponse(response, responseBody);
            response.Close();

            return selfUri;
        }

        public void DeleteDirectory(string uri)
        {
            HttpWebResponse response;

            try
            {
                // A self URI of the directory resource that we want to delete.
                // This URI can be obtained by perform GET request to the
                // directory resource and get the self link.
                var client = (HttpWebRequest)WebRequest.Create(uri);
                client.Method = "DELETE";
                response = (HttpWebResponse)client.GetResponse();
            }
            catch (WebException e)
            {
                response = (HttpWebResponse)e.Response;
            }

            var responseBody = Util.GetResponseBody(response);
            Util.PrintHttpWebResponse(response, responseBody);
            response.Close();
        }

        public string CreatePlaylist()
        {
            HttpWebResponse response;

            try
            {
                // Create a connection to the URI that we want to create
                // a playlist under it.
                var client = (HttpWebRequest)WebRequest.Create(
                    "http://127.0.0.1:8580/directory/playlists/");

                client.Method = "POST";
                client.ContentType = "application/vnd.vizrt.payload+xml;type=playlist";
                client.Headers.Add("Slug", "TheVeryNewPlaylist");

                response = (HttpWebResponse)client.GetResponse();
            }
            catch (WebException e)
            {
                response = (HttpWebResponse)e.Response;
            }

            var responseBody = Util.GetResponseBody(response);
            var selfUri = Util.GetSelfUri(responseBody);

            Util.PrintHttpWebResponse(response, responseBody);
            response.Close();

            return selfUri;
        }

        public void DeletePlaylist(string uri)
        {
            HttpWebResponse response;

            try
            {
                // A self URI of the playlist resource that we want to delete.
                // This URI can be obtained by perform GET request to the
                // playlist resource and get the self link.
                var client = (HttpWebRequest)WebRequest.Create(uri);
                client.Method = "DELETE";
                response = (HttpWebResponse)client.GetResponse();
            }
            catch (WebException e)
            {
                response = (HttpWebResponse)e.Response;
            }

            var responseBody = Util.GetResponseBody(response);
            Util.PrintHttpWebResponse(response, responseBody);
            response.Close();
        }
    }

    // --------------------------------------------------------------------

    class Program
    {
        static void Main(string[] args)
        {
            var myExample = new DirectoryHandlingExample();

            Console.WriteLine(@"This is a directory handling example.
This example shows four operations, create/delete directory and create/delete playlist.

Preparation steps:
1. Load the ""default.xml"" in ""TestResources"" folder by copying it to
   ""%programdata%\Vizrt\Media Sequencer"".
2. Open MSE.
3. Start Trio.");
            Console.WriteLine();

            Console.WriteLine();
            Console.Write(">> Press [enter] to create a new directory: ");
            Console.ReadLine();

            var dirUri = myExample.CreateDirectory();

            Console.WriteLine();
            Console.Write(">> Press [enter] to delete the created directory: ");
            Console.ReadLine();

            myExample.DeleteDirectory(dirUri);

            Console.WriteLine();
            Console.Write(">> Press [enter] to create a new playlist: ");
            Console.ReadLine();

            var playlistUri = myExample.CreatePlaylist();

            Console.WriteLine();
            Console.Write(">> Press [enter] to delete the created playlist: ");
            Console.ReadLine();

            myExample.DeletePlaylist(playlistUri);
        }
    }
}
