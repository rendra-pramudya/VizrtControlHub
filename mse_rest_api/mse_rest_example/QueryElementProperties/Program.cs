using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading.Tasks;
using System.Xml;

namespace QueryElementProperties
{
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
            nameSpaceManager_.AddNamespace("media", "http://search.yahoo.com/mrss/");
        }

        private static string FormatXml(string xml)
        {
            try
            {
                var doc = new XmlDocument();
                doc.LoadXml(xml);
                return ConvertXmlDocumentToString(doc);
            }
            catch (XmlException)
            {
                return xml;
            }
        }

        internal static XmlDocument LoadXMLFromUri(string uri)
        {
            var doc = new XmlDocument();
            doc.Load(uri);
            return doc;
        }

        internal static string ConvertXmlDocumentToString(XmlDocument doc)
        {
            var sw = new StringWriter();
            var tx = new XmlTextWriter(sw);
            tx.Formatting = Formatting.Indented;
            doc.WriteTo(tx);
            return sw.ToString();
        }

        internal static string GetValueFromDocumentByXPath(XmlDocument doc, string xpath)
        {
            var nav = doc.CreateNavigator();
            var it = nav.Select(xpath, nameSpaceManager_);
            if (it.MoveNext())
            {
                return it.Current.Value;
            }

            return "";
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
    }

    // --------------------------------------------------------------------

    internal class QueryElementPropertiesExample
    {
        private string GetProfileCommandUri()
        {
            var profileDoc = Util.LoadXMLFromUri("http://127.0.0.1:8580/profiles/");

            var profileUri = Util.GetValueFromDocumentByXPath(profileDoc,
                "//atom:entry/atom:link[@rel='alternate']/@href");

            var showDoc = GetElementCollectionResource("My Show");

            var showUri = Util.GetValueFromDocumentByXPath(showDoc,
                "//atom:feed/atom:link[@rel='self']/@href");

            var showPath = new Uri(showUri).AbsolutePath;

            // Construct a URI in the following format.
            // http://127.0.0.1:8580/profiles/default/?playlist=/element_collection/...
            return profileUri + "?playlist=" + showPath;
        }

        private XmlDocument GetElementCollectionResource(string showName)
        {
            var serviceDoc = Util.LoadXMLFromUri("http://127.0.0.1:8580/");

            var dirUri = Util.GetValueFromDocumentByXPath(serviceDoc,
                "//app:service/app:workspace/app:collection"
                    + "[app:categories/atom:category[@term='directory']]/@href");

            var dirDoc = Util.LoadXMLFromUri(dirUri);

            var dirShowUri = Util.GetValueFromDocumentByXPath(dirDoc,
                "//atom:feed/atom:entry[atom:category"
                    + "[@term='directory'] and atom:title[text()='shows']]/"
                        + "atom:link[@rel='alternate']/@href");

            var dirShowDoc = Util.LoadXMLFromUri(dirShowUri);

            var myShowUri = Util.GetValueFromDocumentByXPath(dirShowDoc,
                "//atom:feed/atom:entry[atom:title[text()='"
                    + showName + "']]/atom:link[@rel='alternate']/@href");

            var myShowDoc = Util.LoadXMLFromUri(myShowUri);

            var elementCollectionUri = Util.GetValueFromDocumentByXPath(myShowDoc,
                "//atom:feed/atom:entry[atom:category"
                    + "[@term='element_collection']]/atom:link[@rel='alternate']/@href");

            return Util.LoadXMLFromUri(elementCollectionUri);
        }

        internal void InitializeShow()
        {
            HttpWebResponse response;

            try
            {
                var uri = GetProfileCommandUri();
                var client = (HttpWebRequest)WebRequest.Create(uri);
                var bodyBytes = Encoding.UTF8.GetBytes("initialize");

                client.Method = "POST";
                client.ContentType = "text/plain";
                client.ContentLength = bodyBytes.Length;
                client.GetRequestStream().Write(bodyBytes, 0, bodyBytes.Length);

                response = (HttpWebResponse)client.GetResponse();
            }
            catch (WebException e)
            {
                response = (HttpWebResponse)e.Response;
            }

            var responseBody = Util.GetResponseBody(response);
            Util.PrintHttpWebResponse(response, responseBody);
        }

        internal XmlDocument GetElementCollectionEntryResource()
        {
            var elementCollectionDoc = GetElementCollectionResource("My Show");

            var elementCollectionEntryUri = Util.GetValueFromDocumentByXPath(
                elementCollectionDoc, "//atom:feed/atom:entry/atom:link[@rel='self']/@href");

            return Util.LoadXMLFromUri(elementCollectionEntryUri);
        }

        internal string QueryLoadedStatus(XmlDocument element)
        {
            return Util.GetValueFromDocumentByXPath(element,
                "//atom:entry/viz:loaded_status");
        }

        internal string QueryAvailableStatus(XmlDocument element)
        {
            return Util.GetValueFromDocumentByXPath(element,
                "//atom:entry/viz:available_status");
        }

        internal string QueryMediaThumbnail(XmlDocument element)
        {
            return Util.GetValueFromDocumentByXPath(element,
                "//atom:entry/media:thumbnail/@url");
        }
    }

    // --------------------------------------------------------------------

    class Program
    {
        static void Main(string[] args)
        {
            var myExample = new QueryElementPropertiesExample();

            Console.WriteLine(
@"This example shows how to query element properties.

Preparation steps:
1. Load the ""default.xml"" in ""TestResources"" folder by copying it to
   ""%programdata%\Vizrt\Media Sequencer"".
2. Open MSE.");

            Console.WriteLine();
            Console.Write(">> Press [Q] to quit or [any key] to continue: ");
            var cmd = Console.ReadKey();
            if (cmd.KeyChar == 'q' || cmd.KeyChar == 'Q')
                return;

            Console.WriteLine();
            Console.WriteLine();
            Console.WriteLine("Show initializing...");

            // Initialize the playlist to make 'loaded_status'
            // and 'available_status' appears.
            myExample.InitializeShow();

            Console.WriteLine("Show initialized.");

            var element = myExample.GetElementCollectionEntryResource();

            Console.WriteLine();
            Console.WriteLine("Element:");
            Console.WriteLine(Util.ConvertXmlDocumentToString(element));
            Console.WriteLine();

            Console.WriteLine("loaded status: "
                + myExample.QueryLoadedStatus(element));
            Console.WriteLine("available status: "
                + myExample.QueryAvailableStatus(element));
            Console.WriteLine("thumbnail: "
                + myExample.QueryMediaThumbnail(element));
        }
    }
}
