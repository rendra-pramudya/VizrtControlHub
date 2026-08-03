using System;
using System.Collections.Generic;
using System.Net;
using System.Text;
using System.Xml;

namespace CreatePageUsingVdfDocument
{
    class PageCreationExample
    {
        private XmlNamespaceManager nameSpaceManager_;

        public PageCreationExample()
        {
            nameSpaceManager_ = new XmlNamespaceManager(new NameTable());
            nameSpaceManager_.AddNamespace("viz", "http://www.vizrt.com/atom");
            nameSpaceManager_.AddNamespace("atom", "http://www.w3.org/2005/Atom");
            nameSpaceManager_.AddNamespace("vdf", "http://www.vizrt.com/types");
            nameSpaceManager_.AddNamespace("app", "http://www.w3.org/2007/app");
            nameSpaceManager_.AddNamespace("vaext", "http://www.vizrt.com/atom-ext");
        }

        public string GetElementCollectionUri(
            string serviceDocUri, string showName)
        {
            // Get service document.
            var serviceDoc = LoadXMLFromUri(serviceDocUri);

            // Extract directory uri.
            string directoryUri = GetValueFromDocumentByXPath(serviceDoc,
                "//app:service/app:workspace/app:collection[app:categories/atom:category[@term='directory']]/@href");

            // Get directory document.
            var directoryDoc = LoadXMLFromUri(directoryUri);

            // Extract directory/shows uri.
            string directoryShowUri = GetValueFromDocumentByXPath(directoryDoc,
                "//atom:feed/atom:entry[atom:category[@term='directory'] and atom:title[text()='shows']]/atom:link[@rel='alternate']/@href");

            // Get directory/shows document.
            var directoryShowDoc = LoadXMLFromUri(directoryShowUri);

            // Extract show uri from the given showName.
            string myShowUri = GetValueFromDocumentByXPath(directoryShowDoc,
                "//atom:feed/atom:entry[atom:title[text()='" + showName + "']]/atom:link[@rel='alternate']/@href");

            // Get show document.
            var myShowDoc = LoadXMLFromUri(myShowUri);

            // Extract element collection uri.
            string elementCollectionUri = GetValueFromDocumentByXPath(myShowDoc,
                "//atom:feed/atom:entry[atom:category[@term='element_collection']]/atom:link[@rel='alternate']/@href");

            return elementCollectionUri;
        }

        public string GetElementModelUri(
            string elementCollectionUri, string modelTitle)
        {
            var elementCollectionDoc = LoadXMLFromUri(elementCollectionUri);

            string templateCollectionUri = GetValueFromDocumentByXPath(elementCollectionDoc,
                "//atom:feed/atom:link[@rel='related']/@href");

            var templateCollectionDoc = LoadXMLFromUri(templateCollectionUri);

            string xpath = string.Format(
                "//atom:feed/atom:entry[atom:title[text()='{0}']]/atom:link[@rel='alternate']/@href"
                , modelTitle);
            var elementModelUri = GetValueFromDocumentByXPath(
                templateCollectionDoc, xpath);

            return elementModelUri;
        }

        public string ConstructVDFDocument(
            string elementModelUri, Dictionary<string, string> fieldValue)
        {
            string vdf = "<payload xmlns=\"http://www.vizrt.com/types\" model=\"" + elementModelUri + "\">";
            foreach (var item in fieldValue)
            {
                vdf += string.Format(
                    @"<field name=""{0}""><value>{1}</value></field>",
                    item.Key, item.Value);
            }
            vdf += "</payload>";
            return vdf;
        }

        public string CreateElementUsingVdfDocument(
            string elementCollectionUri, string vdfDocument)
        {
            Console.WriteLine(" - POSTing VDF element to " + elementCollectionUri);

            const string vdfElementType =
            "application/vnd.vizrt.payload+xml;type=element";
            HttpWebResponse res = PostOnUri(
                elementCollectionUri, vdfDocument, vdfElementType);

            if (res.StatusCode == System.Net.HttpStatusCode.Created)
            {
                string elementUri = res.Headers["location"];
                Console.WriteLine(" - Element added, URI = {0}", elementUri);
                return elementUri;
            }
            else if (res.StatusCode == System.Net.HttpStatusCode.Accepted)
            {
                string pendingElementUri = res.Headers["location"];
                Console.WriteLine(
                    " - Pending element received, URI = {0}", pendingElementUri);
                return pendingElementUri;
            }
            else
            {
                Console.WriteLine(" - Element is not added.");
            }
            return "";
        }

        public void DeleteElement(string elementCollectionEntryUri)
        {
            HttpWebResponse res = DeleteOnUri(elementCollectionEntryUri);
            if (res.StatusCode == System.Net.HttpStatusCode.NoContent)
                Console.WriteLine(" - Element deleted, URI = {0}", elementCollectionEntryUri);
            else
                Console.WriteLine(" - Element is not deleted.");
        }

        private XmlDocument LoadXMLFromUri(string uri)
        {
            XmlDocument doc = new XmlDocument();
            doc.Load(uri);
            return doc;
        }

        private string GetValueFromDocumentByXPath(XmlDocument doc, string xpath)
        {
            var nav = doc.CreateNavigator();
            var it = nav.Select(xpath, nameSpaceManager_);
            if (it.MoveNext())
            {
                return it.Current.Value;
            }

            return "";
        }

        private HttpWebResponse PostOnUri(
            string uri, string body, string contentType)
        {
            try
            {
                byte[] bodyBytes = Encoding.UTF8.GetBytes(body);

                var client = (HttpWebRequest)HttpWebRequest.Create(uri);
                client.AllowAutoRedirect = false;
                client.AllowWriteStreamBuffering = false;

                client.Method = "POST";
                client.ContentType = contentType;
                client.ContentLength = bodyBytes.Length;

                client.GetRequestStream().Write(bodyBytes, 0, bodyBytes.Length);
                return (HttpWebResponse)client.GetResponse();
            }
            catch (WebException e)
            {
                return (HttpWebResponse)e.Response;
            }
        }

        private HttpWebResponse DeleteOnUri(string uri)
        {
            try
            {
                var client = (HttpWebRequest)HttpWebRequest.Create(uri);
                client.AllowAutoRedirect = false;
                client.AllowWriteStreamBuffering = false;
                client.Method = "DELETE";
                return (HttpWebResponse)client.GetResponse();
            }
            catch (WebException e)
            {
                return (HttpWebResponse)e.Response;
            }
        }
    }

    class Program
    {
        static void Main(string[] args)
        {
            Console.Write(
@"This is the CreatePageUsingVdfDocument example.

To setup environment for this example:
1. Load the ""default.xml"" in ""TestResources"" folder by copying it to
   ""%programdata%\Vizrt\Media Sequencer"".
2. Open MSE.
3. Load Trio's show ""example_show.trioshow"" in ""TestResources"" folder
   to Viz Trio.

Press enter to create a new element with the template ""One""
in the ""DemoShow"" show.");
            Console.ReadLine();

            PageCreationExample myExample =
                new PageCreationExample();

            // Get element collection uri of show "DemoShow"
            string serviceDocUri = "http://127.0.0.1:8580";
            string showName = "DemoShow";
            string elementCollectionUri =
                myExample.GetElementCollectionUri(serviceDocUri, showName);

            // Construct VDF document using template "One".
            string elementModelUri =
                myExample.GetElementModelUri(elementCollectionUri, "One");
            string vdfDocument = myExample.ConstructVDFDocument(
                elementModelUri,
                new Dictionary<string, string> { {"1", "**Just Created!**"} });

            // Create a new page with the template "One" in the "DemoShow" show.
            string elementCollectionEntryUri =
                myExample.CreateElementUsingVdfDocument(
                    elementCollectionUri, vdfDocument);

            Console.Write(
                "\nPress enter to delete the element created."
                );
            Console.ReadLine();
            myExample.DeleteElement(elementCollectionEntryUri);
        }
    }
}
